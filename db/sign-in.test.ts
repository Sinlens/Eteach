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
