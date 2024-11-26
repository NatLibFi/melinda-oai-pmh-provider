import {DB_TIME_FORMAT, MAX_DOC_NUMBER} from './common';

export default ({library, limit}) => ({
  getSingleRecord: ({identifier}) => {
    if (identifier) {
      return {
        args: {identifier},
        query: `SELECT id, time, z00_data record FROM (SELECT z13_rec_key id, z13_upd_time_stamp time FROM ${library}.z13 WHERE z13_rec_key = ':identifier') JOIN ${library}.z00 ON id = z00_doc_number`
      };
    }
    throw new Error(`getSingleRecord needs identifier`);
  },
  getHeadingsIndex: ({value}) => ({
    args: {value},
    query: `SELECT z01_acc_sequence id FROM ${library}.z01 WHERE z01_rec_key like ':value'`
  }),
  getEarliestTimestamp: () => ({
    query: `SELECT MIN(z13_upd_time_stamp) time FROM ${library}.z13`
  }),
  getRecords: ({cursor = '000000000', startTime, endTime, indexes = {}}) => {
    return {
      args: genArgs(),
      query: genQuery()
    };

    function genArgs() {
      const args = {cursor};

      if (startTime && endTime) {
        return {
          ...args,
          startTime: startTime.format(DB_TIME_FORMAT),
          endTime: endTime.format(DB_TIME_FORMAT)
        };
      }

      if (startTime) {
        return {
          ...args,
          startTime: startTime.format(DB_TIME_FORMAT)
        };
      }

      if (endTime) {
        return {
          ...args,
          endTime: endTime.format(DB_TIME_FORMAT)
        };
      }

      return args;
    }

    function genQuery() {
      const conditions = generateTimeConditions();
      const indexStatements = generateIndexStatements();
      return `SELECT id, time, z00_data record FROM (SELECT z13_rec_key id, z13_upd_time_stamp time FROM ${library}.z13 s1 ${indexStatements} WHERE s1.z13_rec_key > ':cursor' AND s1.z13_rec_key <= '${MAX_DOC_NUMBER}' ${conditions} FETCH NEXT ${limit + 1} ROWS ONLY) JOIN ${library}.z00 ON id = z00_doc_number`;

      function generateTimeConditions() {
        const start = `s1.z13_upd_time_stamp >= ':startTime'`;
        const end = `s1.z13_upd_time_stamp <= ':endTime'`;
        if (startTime && endTime) {
          return `AND ${start} AND ${end}`;
        }
        if (startTime) {
          return `AND ${start}`;
        }
        if (endTime) {
          return `AND ${end}`;
        }
        return '';
      }

      function generateIndexStatements() {
        if (indexes.heading) {
        // return indexes.heading.map((value, index) => `JOIN ${library}.z02 h${index} ON z13_rec_key = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`).join(' ');
          return indexes.heading.map((value, index) => `AND EXISTS (SELECT 1 FROM ${library}.z02 h${index} WHERE h${index}.z02_rec_key = CONCAT('${value}', s1.z13_rec_key))'`).join(' ');
        }
        return '';
      }
    }
  }
});
