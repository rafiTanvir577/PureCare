import { Db } from 'mongodb';
import * as bcrypt from 'bcrypt';

export const up = async (db: Db): Promise<void> => {
  try {
    const practitioners = await db
      .collection('waiting_lists')
      .find({ recoveryCodes: { $exists: true } })
      ?.toArray();

    await Promise.all(
      practitioners?.map(async (practitioner) => {
        const recoveryCodes = practitioner?.recoveryCodes;
        const updatedCodes = [];

        try {
          for await (const recoveryCode of recoveryCodes) {
            const bcryptHashRegex = /^\$2[aby]\$.{56}$/;
            const isALreadyHashed = bcryptHashRegex?.test(
              recoveryCode?.code?.toString(),
            );
            const hashedCode = isALreadyHashed
              ? recoveryCode.code
              : await bcrypt.hash(recoveryCode?.code?.toString(), 10);
            updatedCodes.push({
              ...recoveryCode,
              code: hashedCode,
            });
          }
        } catch (error) {
          console.log(error);
        }

        await db
          .collection('waiting_lists')
          .updateOne(
            { _id: practitioner?._id },
            { $set: { recoveryCodes: updatedCodes } },
          );
      }),
    );
  } catch (error) {
    console.error('Recovery code migration failed:', error);
  }
};

export const down = async (): Promise<void> => {
  // In the down function, you might want to reverse the action of the up function
};
