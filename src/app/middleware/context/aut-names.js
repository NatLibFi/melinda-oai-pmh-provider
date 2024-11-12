

import {formatAut, stripPrivateFields as stripPrivateFieldsDefault} from './common';

export default ({isPrivileged, alephLibrary, melindaPrefix}) => ({
  repoName: 'Melinda OAI-PMH provider for authority aux records',
  isSupportedFormat: f => ['marc21', 'melinda_marc'].includes(f),
  formatRecord: (record, id, metadataPrefix, logLabel) => {
    const newRecord = formatAut({
      record, id, metadataPrefix,
      oldPrefix: alephLibrary.toUpperCase(),
      newPrefix: melindaPrefix,
      logLabel

    });

    return isPrivileged ? newRecord : stripPrivateFields(newRecord);

    function stripPrivateFields(record) {
      const newRecord = stripPrivateFieldsDefault(record);
      newRecord.get(/^375|^667$/u).forEach(f => newRecord.removeField(f));
      return newRecord;
    }
  }
});
