/**
 * The delete path, as a port.
 *
 * `20260926120000_initial_schema.sql` required this alongside the retention
 * window: the window is time-based and automatic, this is somebody deciding
 * now that they want none of it kept.
 *
 * It sits apart from the other ports on purpose. History, saved phrases and
 * feedback each own one kind of row; this owns the person's whole footprint,
 * and belongs to none of them.
 */
export interface StoredDataService {
  /**
   * Removes everything stored for this device and issues a new identity.
   *
   * The identity rotation is part of the contract, not an implementation
   * detail. Deleting the rows while the browser keeps the key they were filed
   * under leaves the link intact and rebuilds a profile on the next request.
   */
  deleteEverything(): Promise<void>;
}

export class StoredDataServiceError extends Error {
  constructor(message = "Your data could not be deleted. Nothing was removed.") {
    super(message);
    this.name = "StoredDataServiceError";
  }
}
