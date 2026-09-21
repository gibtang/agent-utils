import { connectDB } from '@/lib/core/db';
import { resourceId } from '@/lib/core/ids';
import Account, { type AccountDocument } from '@/models/Account';

export type ProvisionAccountInput = {
  uid: string;
  email: string | null | undefined;
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
};

export type ProvisionAccountResult = {
  account: AccountDocument;
  /** True only when this call observed no existing account before provisioning. */
  created: boolean;
};

/** Create an owner's account once, while refreshing Firebase-safe profile data. */
export async function provisionAccountWithStatus(input: ProvisionAccountInput): Promise<ProvisionAccountResult> {
  await connectDB();

  // Keep the account write atomic and use the pre-write existence check only
  // to give the browser a truthful first-registration signal. The account's
  // unique ownerUid index remains the source of truth under concurrent writes.
  const existed = Boolean(await Account.exists({ ownerUid: input.uid }));
  const account = await Account.findOneAndUpdate(
    { ownerUid: input.uid },
    {
      $set: {
        ownerEmail: input.email ?? null,
        ownerDisplayName: input.displayName ?? null,
        ownerPhotoUrl: input.photoURL ?? null,
      },
      $setOnInsert: { accountId: resourceId('acct_') },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  if (!account) throw new Error('Account provisioning did not return an account');
  return { account, created: !existed };
}

/** Backwards-compatible account provisioning for server-side callers. */
export async function provisionAccount(input: ProvisionAccountInput): Promise<AccountDocument> {
  return (await provisionAccountWithStatus(input)).account;
}
