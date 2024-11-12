

import {formatBib, stripPrivateFields} from './common';

export default ({isPrivileged, alephLibrary, melindaPrefix}) => ({
  repoName: 'Melinda OAI-PMH provider for bibliographic records',
  isSupportedFormat: f => ['oai_dc', 'marc21', 'melinda_marc'].includes(f),
  formatRecord: (record, id, metadataPrefix, logLabel) => {
    const newRecord = formatBib({
      record, id, metadataPrefix,
      oldPrefix: alephLibrary.toUpperCase(),
      newPrefix: melindaPrefix,
      logLabel
    });

    return isPrivileged ? newRecord : stripPrivateFields(newRecord);
  }
});
