import { connectDB } from '@/lib/core/db';
import { resourceId } from '@/lib/core/ids';
import Account, { type AccountDocument } from '@/models/Account';

export type ProvisionAccountInput = {
  uid: string;
  email: string | null | undefined;
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
};

/** Create an owner's account once, while refreshing Firebase-safe profile data. */
export async function provisionAccount(input: ProvisionAccountInput): Promise<AccountDocument> {
  await connectDB();

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
  return account;
}
