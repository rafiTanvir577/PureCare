import { readFileSync } from 'fs';
import * as ejs from 'ejs';
import Mongoose from 'mongoose';
import { SendGridService } from 'src/helper/sendgrid';
import { Role } from 'src/entity';

const practitionerMap = {};

export function monit() {
  console.log('Started watching database for changes');

  const watcher = Mongoose.connection.db.watch(
    [
      {
        $match: {
          operationType: {
            $in: ['insert', 'delete', 'drop', 'dropDatabase'],
          },
          'ns.coll': {
            // these collections are like of short time data storing/caching.
            // So can be deleted frequently
            $nin: ['graphs', 'analysis_queues', 'relationships'],
          },
        },
      },
    ],
    {
      fullDocument: 'updateLookup',
    },
  );
  watcher.on('change', (stream) => {
    /**
     * All delete should be notified
     * Except
     * Practitioner can be moved to separate collection
     */
    if (stream.operationType === 'delete') {
      if (['waiting_lists', 'deactive-waiting_lists'].includes(stream.ns.coll)) {
        // an account has been deleted. So waiting for insertion
        // on another collection
        practitionerMap[stream.documentKey._id.toString()] = {
          insertedAt: new Date(),
          data: stream,
        };
      } else {
        notifyAdmin(stream);
      }
    } else if (stream.operationType === 'insert') {
      if (['waiting_lists', 'deactive-waiting_lists'].includes(stream.ns.coll)) {
        // an account has been inserted. Maybe this has been deleted
        // from another collection. So check and delete it
        delete practitionerMap[stream.documentKey._id.toString()];
      }
    } else {
      notifyAdmin(stream);
    }
  });
}

/** Watch for changes in practitioner and deactivate practitioner collection.
 * If the deleted data from one collection is not inserted within 2 second
 * Then notify admin about the data loss
 */
setInterval(() => {
  const twoSecondPast = new Date();
  twoSecondPast.setTime(twoSecondPast.getTime() - 2 * 1000);

  for (const key in practitionerMap) {
    const { data, insertedAt } = practitionerMap[key];
    if (insertedAt < twoSecondPast) {
      notifyAdmin(data);
      delete practitionerMap[key];
    }
  }
}, 2000);

async function notifyAdmin(stream) {
  try {
    const templatePath = 'src/helper/templates/data-loss-alert.html';
    const template = readFileSync(templatePath, 'utf8');
    let action = stream?.operationType;
    if (stream?.operationType === 'delete') {
      action = 'Deleted a document';
    } else if (stream?.operationType === 'drop') {
      action = 'Deleted full collection';
    } else if (stream?.operationType === 'dropDatabase') {
      action = 'Deleted full database';
    }

    const html = ejs.render(template, {
      collection: stream?.ns?.coll,
      data_document_id: stream?.documentKey?._id,
      action,
    });

    const admin = await Mongoose.connection.collection('users').findOne({ role: Role.OWNER });

    await new SendGridService().sendMail(admin?.email || 'adigo@pc.com', 'Data Loss Alert!', 'Data Loss Alert!', html);
  } catch (error) {
    console.error('DANGER!! Error sending data loss email!!!!!!!', error);
  }
}
