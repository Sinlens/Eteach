import type { PGlite } from "@electric-sql/pglite";
import { describe, expect } from "vitest";

import { insertProfile, insertTranslation, test } from "./test-support";

/**
 * The pending sign-in.
 *
 * A clickable link completes wherever it is opened, which is rarely where it
 * was asked for — somebody reading mail on a phone signs in there while the
 * history worth keeping sits on the laptop. Requesting a link records which
 * device asked, so the merge can follow the request rather than the click.
 */
async function startSignIn(
  db: PGlite,
  profileId: string,
  email = "someone@example.com",
  ttlMinutes = 15,
): Promise<string> {
  const { rows } = await db.query<{ start_sign_in: string }>(
    "select start_sign_in($1, $2, $3) as start_sign_in",
    [profileId, email, ttlMinutes],
  );

  const id = rows[0]?.start_sign_in;
  if (!id) throw new Error("pending sign-in was not created");
  return id;
}

async function completeSignIn(
  db: PGlite,
  pendingId: string,
  survivorProfileId: string,
  email = "someone@example.com",
) {
  await db.query("select complete_sign_in($1, $2, $3)", [pendingId, email, survivorProfileId]);
}

async function accountProfile(db: PGlite, email = "someone@example.com"): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into users (email) values ($1) returning id",
    [email],
  );

  const { rows: profiles } = await db.query<{ id: string }>(
    "insert into profiles (anonymous_key, user_id) values ($1, $2) returning id",
    [`account_${email}`, rows[0]?.id],
  );

  const id = profiles[0]?.id;
  if (!id) throw new Error("account profile was not created");
  return id;
}

async function countPending(db: PGlite, profileId: string): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from pending_sign_ins where profile_id = $1",
    [profileId],
  );

  return rows[0]?.count ?? 0;
}

describe("start_sign_in", () => {
  test("records which device asked", async ({ db }) => {
    const device = await insertProfile(db, "laptop");

    const pendingId = await startSignIn(db, device);

    const { rows } = await db.query<{ profile_id: string; email: string }>(
      "select profile_id, email from pending_sign_ins where id = $1",
      [pendingId],
    );

    expect(rows[0]?.profile_id).toBe(device);
    expect(rows[0]?.email).toBe("someone@example.com");
  });

  // The newest link is the one the person is about to use. Leaving the earlier
  // ones open would also let a device accumulate rows holding an email address.
  test("replaces an earlier request from the same device", async ({ db }) => {
    const device = await insertProfile(db, "laptop");

    await startSignIn(db, device);
    await startSignIn(db, device);

    expect(await countPending(db, device)).toBe(1);
  });
});

describe("complete_sign_in", () => {
  test("merges the device that asked, not the one that opened the link", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db);
    await insertTranslation(db, laptop, "rw_laptop");

    const pendingId = await startSignIn(db, laptop);
    await completeSignIn(db, pendingId, account);

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from translations where profile_id = $1",
      [account],
    );

    expect(rows[0]?.count).toBe(1);
  });

  /**
   * `merge_profile` deletes the donor, and this row hangs off it with
   * `on delete cascade`. Without being carried across, the record marking this
   * sign-in finished is destroyed by the merge it just performed — and the
   * device still waiting on it would wait forever.
   */
  test("keeps the record after the merge that deletes the donor", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db);

    const pendingId = await startSignIn(db, laptop);
    await completeSignIn(db, pendingId, account);

    const { rows } = await db.query<{ completed_at: Date | null; profile_id: string }>(
      "select completed_at, profile_id from pending_sign_ins where id = $1",
      [pendingId],
    );

    expect(rows[0]?.completed_at).not.toBeNull();
    expect(rows[0]?.profile_id).toBe(account);
  });

  /**
   * Somebody who steals a pending reference could otherwise sign in with their
   * own address and carry the reference of a device that is not theirs,
   * folding a stranger's history into their account.
   */
  test("refuses an address other than the one that asked", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db, "attacker@example.com");
    const pendingId = await startSignIn(db, laptop, "victim@example.com");

    await expect(completeSignIn(db, pendingId, account, "attacker@example.com")).rejects.toThrow();
  });

  test("refuses a reference that has expired", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db);
    const pendingId = await startSignIn(db, laptop, "someone@example.com", -1);

    await expect(completeSignIn(db, pendingId, account)).rejects.toThrow();
  });

  test("refuses a reference that was already used", async ({ db }) => {
    const laptop = await insertProfile(db, "laptop");
    const account = await accountProfile(db);
    const pendingId = await startSignIn(db, laptop);
    await completeSignIn(db, pendingId, account);

    await expect(completeSignIn(db, pendingId, account)).rejects.toThrow();
  });

  test("refuses a reference nobody issued", async ({ db }) => {
    const account = await accountProfile(db);

    await expect(
      completeSignIn(db, "00000000-0000-4000-8000-000000000000", account),
    ).rejects.toThrow();
  });

  /**
   * Signing in again on the device that already holds the account asks to fold
   * a profile into itself, which `merge_profile` refuses outright because
   * `on delete cascade` would empty it. There is nothing to merge, so nothing
   * is merged — the sign-in still completes.
   */
  test("completes without merging on the device that already holds the account", async ({ db }) => {
    const account = await accountProfile(db);
    const pendingId = await startSignIn(db, account);

    await completeSignIn(db, pendingId, account);

    const { rows } = await db.query<{ completed_at: Date | null }>(
      "select completed_at from pending_sign_ins where id = $1",
      [pendingId],
    );

    expect(rows[0]?.completed_at).not.toBeNull();
  });

  /**
   * A shared machine where somebody else is signed in. Their profile holds
   * their `user_id`, so it is not an anonymous donor and none of it belongs to
   * whoever is signing in now.
   */
  test("leaves another account's data alone on a shared device", async ({ db }) => {
    const theirs = await accountProfile(db, "them@example.com");
    const mine = await accountProfile(db, "me@example.com");
    await insertTranslation(db, theirs, "rw_theirs");

    const pendingId = await startSignIn(db, theirs, "me@example.com");
    await completeSignIn(db, pendingId, mine, "me@example.com");

    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from translations where profile_id = $1",
      [theirs],
    );

    expect(rows[0]?.count).toBe(1);
  });
});
