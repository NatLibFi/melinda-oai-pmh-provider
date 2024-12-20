import {DB_TIME_FORMAT, MAX_DOC_NUMBER} from './common';

export default ({library, limit}) => ({
  getSingleRecord: ({identifier}) => {
    if (identifier) {
      return {
        args: {identifier},
        query: `SELECT id, time, z00_data record FROM (SELECT z13_rec_key id, z13_upd_time_stamp time FROM ${library}.z13 WHERE z13_rec_key = :identifier) JOIN ${library}.z00 ON id = z00_doc_number`
      };
    }
    throw new Error(`getSingleRecord needs identifier`);
  },
  getHeadingsIndex: ({value}) => ({
    args: {value},
    query: `SELECT z01_acc_sequence id FROM ${library}.z01 WHERE z01_rec_key like :value`
  }),
  getEarliestTimestamp: () => ({
    query: `SELECT MIN(z13_upd_time_stamp) time FROM ${library}.z13`
  }),
  getRecords: ({cursor = '000000000', startTime, endTime, indexes = {}, timeCursor = undefined}) => {
    if (startTime || endTime) {
      return {
        args: genTimeArgs(),
        query: genTimeQuery()
      };
    }

    return {
      args: genArgs(),
      query: genQuery()
    };

    function genTimeArgs() {

      const startTimeArg = startTime ? startTime.format(DB_TIME_FORMAT) : undefined;
      const endTimeArg = endTime ? endTime.format(DB_TIME_FORMAT) : undefined;
      // If we are using timeCursor, we do not want records that we already have, so let's grow startTime with 1 ms
      const actualStartTimeArg = timeCursor && timeCursor > startTimeArg ? (Number(timeCursor) + 1).toString() : startTimeArg;

      const args = {};

      if (startTime && endTime) {
        return {
          startTime: actualStartTimeArg,
          endTime: endTimeArg
        };
      }

      if (startTime) {
        return {
          startTime: actualStartTimeArg
        };
      }

      if (endTime) {
        return {
          endTime: endTimeArg
        };
      }

      return args;
    }

    function genArgs() {
      const args = {cursor};
      return args;
    }

    function genQuery() {
      const indexStatements = generateIndexStatements();

      return `SELECT id, time, z00_data record FROM (SELECT z13_rec_key id, z13_upd_time_stamp time FROM ${library}.z13 s1 WHERE s1.z13_rec_key > :cursor AND s1.z13_rec_key <= ${MAX_DOC_NUMBER} ${indexStatements} ORDER BY s1.z13_rec_key FETCH NEXT ${limit} ROWS ONLY) JOIN ${library}.z00 ON id = z00_doc_number`;
    }

    function genTimeQuery() {
      const conditions = generateTimeConditions();
      const indexStatements = generateIndexStatements();

      // DEVELOP: should we have here WITH TIES instead of only?
      return `SELECT id, time, z00_data record FROM (SELECT z13_rec_key id, z13_upd_time_stamp time FROM ${library}.z13 s1 ${conditions} ${indexStatements} ORDER BY s1.z13_upd_time_stamp FETCH NEXT ${limit} ROWS WITH TIES) JOIN ${library}.z00 ON id = z00_doc_number`;

      function generateTimeConditions() {
        // DEVELOP we get results with last time here!
        const start = `s1.z13_upd_time_stamp >= :startTime`;
        const end = `s1.z13_upd_time_stamp <= :endTime`;
        if (startTime && endTime) {
          return `WHERE ${start} AND ${end}`;
        }
        if (startTime) {
          return `WHERE ${start}`;
        }
        if (endTime) {
          return `WHERE ${end}`;
        }
        return '';
      }

    }

    function generateIndexStatements() {
      if (indexes.heading) {
      // return indexes.heading.map((value, index) => `JOIN ${library}.z02 h${index} ON z13_rec_key = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`).join(' ');
        return indexes.heading.map((value, index) => `AND EXISTS (SELECT 1 FROM ${library}.z02 h${index} WHERE h${index}.z02_rec_key = CONCAT('${value}', s1.z13_rec_key))`).join(' ');
      }
      return '';
    }

  }
});
