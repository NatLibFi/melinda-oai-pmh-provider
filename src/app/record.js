

import {AlephSequential} from '@natlibfi/marc-record-serializers';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/record');
const debugDev = debug.extend('dev');
const debugDevData = debugDev.extend('data');


export function parseRecord({data, validate = false, noFailValidation = false, logLabel}) {
  debugDev(`${logLabel} parseRecord: create AlephSequential from dbResult data`);
  debug(data.toString());
  const buffer = Buffer.from(data);
  return iterate();

  function iterate(offset = 0, lines = []) {
    if (offset + 4 > buffer.length) {
      const str = lines.join('\n');
      return transformRecord(str);
    }

    const length = Number(buffer.toString('utf8', offset, offset + 4));
    offset += 4;
    // nTooLong counts deprecated UTF-8 chars (range 65536...) such as '𝑁' as two chars
    //const [ lengthInBytes, nTooLong ] = lengthInCharsToOtherLengths();

    const subBuffer = buffer.subarray(offset, offset+length);
    debug(`SUBBUF (${length}): '${subBuffer.toString()}'`);
    const line = subBuffer.toString('utf8');
    //const line = buffer.toString('utf8', offset, offset + length);

    return iterate(offset + length, lines.concat(format(line)));

    // Format Aleph-database string to Aleph Sequential
    function format(l) {
      const start = l.substr(0, 5);
      const end = l.substr(6);
      return `000000000 ${start} L ${end}`;
    }

    function transformRecord(str) {
      debugDev(`${logLabel} transformRecord: create marcRecord object from AlephSequential`);
      // Create record from AlephSequential string
      const record = AlephSequential.from(str, getValidationOptions());

      format();

      return record;

      // This could be done in marc-record-js / marc-record-serializers
      function format() {
        debugDev(`${logLabel} format whitespace in fixed fields`);
        record.leader = formatWhitespace(record.leader);
        // we handle only fields with values = fixed length fields
        record.fields.filter(({value}) => value).forEach(({value}) => formatWhitespace(value));

        function formatWhitespace(value) {
          return value.replace(/\^/gu, ' ');
        }
      }

      function getValidationOptions() {
        // Note that marc-record-js has currently more validationOptions than these
        // noFailValidation: return record and possible validationErrors
        if (validate) {
          // ignore missing subfieldValues anyways
          return {subfieldValues: false, noFailValidation};
        }
        // DEVELOP: Note that marc-record-js has more validationOptions than these
        return {fields: false, subfields: false, subfieldValues: false, noFailValidation};
      }
    }
  }
}

// Create record in Aleph-db-text form from record object, used for tests
export function dbDataStringFromRecord(record) {
  debugDev(`dbDataStringFromRecord: create record data `);
  const seq = AlephSequential.to(record, {subfieldValues: false});
  debugDev(`Created AlephSequential from record`);
  debugDevData(seq);
  debugDev(`Creating dbResult like string from AlephSequential`);

  const buffers = seq.split('\n').slice(0, -1).map(str => {
    const data = str.slice(10);
    const start = data.slice(0, 5);
    // Offset is after is first 5 chars  + `L `
    const end = data.slice(8);
    // We need a buffer so that the total number of bytes can calculated
    const dataBuffer = Buffer.from(`${start}L${end}`);
    //const lengthInBytes = getOffsetSizeInBytes(dataBuffer, 0, dataBuffer.length);
    const lengthPrefix = String(dataBuffer.length).padStart(4, '0'); // 24 => "0024"

    return Buffer.concat([Buffer.from(lengthPrefix), dataBuffer]);
  });

  return Buffer.concat(buffers);
}


function getOffsetSizeInBytes(buffer, offset, length) {
  let i = 0;
  let bytepos = offset;
  while ( i < length ) {
    // https://en.wikipedia.org/wiki/UTF-8
    // 2-byte UTF-8 char (128-2047)
    if (buffer[bytepos] >= 192 && buffer[bytepos] <= 223 && buffer[bytepos+1] >= 128 && buffer[bytepos+1] < 192 ) {
      bytepos += 2;
    }
    // 3-byte UTF-8 char (2048-65535
    else if (buffer[bytepos] >= 224 && buffer[bytepos] <= 239 && buffer[bytepos+1] >= 128 && buffer[bytepos+1] < 192 && buffer[bytepos+2] >= 128 && buffer[bytepos+2] < 192 ) {
      bytepos += 3;
    }
    // 4-byte *non-standard* UTF-8 char (65535-...) This is not calculated corrently by string.length.
    else if (buffer[bytepos] >= 240 && buffer[bytepos] <= 247 && buffer[bytepos+1] >= 128 && buffer[bytepos+1] < 192 && buffer[bytepos+2] >= 128 && buffer[bytepos+2] < 192  && buffer[bytepos+3] >= 128 && buffer[bytepos+3] < 192 ) {
      bytepos += 4;
    }
    else { // Everything else is read as a single byte
    	// 1-byte UTF-8 char (0-127)
      // 128-159 CP-1252 or some other MS code page?
      // 160-191 are probably some iso-latin-1 etc  values
      // 248-255 are some mysterious crap
      bytepos++;
    }
    i++;
  }
  if (offset === 0) {
    debug(`OFFSET SIZE: ${bytepos - offset}: '${buffer.toString()}'`);
  }
  return bytepos - offset;
}

