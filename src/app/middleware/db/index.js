import moment from 'moment';
import {isDeletedRecord, toAlephId} from '@natlibfi/melinda-commons';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {MarcRecord} from '@natlibfi/marc-record';
import {DB_TIME_FORMAT} from './common';
import {parseRecord} from '../../record';
import queryFactory from './query';

import createDebugLogger from 'debug';
const debug = createDebugLogger('@natlibfi/melinda-oai-pmh-provider/db:index');
const debugDev = debug.extend('dev');
const debugDevData = debugDev.extend('data');

export default async function ({maxResults, sets, alephLibrary, connection, formatRecord}) {
  const logger = createLogger();
  const {getEarliestTimestamp, getHeadingsIndex, getRecords, getSingleRecord} = queryFactory({
    library: alephLibrary, limit: maxResults
  });

  const indexes = await getIndexes();
  const earliestTimestamp = await retrieveEarliestTimestamp();

  // Disable all validation because invalid records shouldn't crash the app
  // DEVELOP: newer marc-record-js version have more validationOptions
  // validationOptions are also handled later in code
  MarcRecord.setValidationOptions({
    fields: false,
    subfields: false,
    subfieldValues: false
  });

  return {listRecords, listIdentifiers, getRecord, earliestTimestamp};

  function getIndexes() {
    debugDev(`getIndexes: sets: ${JSON.stringify(sets)}`);
    if (sets.length === 0) {
      return {};
    }

    const cache = {};

    return get(sets.slice());

    async function get(sets, results = {}) {
      const [set] = sets;

      if (set) {
        const {spec, indexes} = set;

        if (indexes.heading) {
          const headingIndexes = await getHeadingIndexes(indexes.heading.slice());

          return get(sets.slice(1), {...results, [spec]: {
            ...indexes,
            heading: headingIndexes
          }});
        }

        return get(sets.slice(1), {...results, [spec]: indexes});
      }

      return results;

      async function getHeadingIndexes(values, results = []) {
        debugDev(`getHeadingsIndexes`);
        const [value] = values;

        if (value) {
          if ([value] in cache) {
            return getHeadingIndexes(values.slice(1), results.concat(cache[value]));
          }

          const {query, args} = getQuery(getHeadingsIndex({value}));
          const {resultSet} = await connection.execute(query, args, {resultSet: true});
          const row = await resultSet.getRow();

          await resultSet.close();

          cache[value] = `${row.ID}`; // eslint-disable-line functional/immutable-data, require-atomic-updates
          // cache[value] = `${row.ID}%`; // eslint-disable-line functional/immutable-data, require-atomic-updates
          return getHeadingIndexes(values.slice(1), results.concat(cache[value]));
        }

        return results;
      }
    }
  }

  async function retrieveEarliestTimestamp() {
    logger.debug(`retrieveEarliestTimestamp`);
    debugDev(`retrieveEarliestTimestamp`);
    const {query, args} = getQuery(getEarliestTimestamp());
    const {resultSet} = await connection.execute(query, args, {resultSet: true});
    const row = await resultSet.getRow();

    await resultSet.close();
    return moment.utc(row.TIME, DB_TIME_FORMAT);
  }

  async function getRecord({logLabel, connection, identifier, metadataPrefix}) {
    debugDev(`${logLabel} getRecord`);
    const {query, args} = getQuery(getSingleRecord({identifier: toAlephId(identifier)}), logLabel);
    const {resultSet} = await connection.execute(query, args, {resultSet: true});
    // DO NOT try to JSON.stringify resultSet! its circular.
    //debugDev(`${logLabel} resultSet: ${JSON.stringify(resultSet)}`);
    const row = await resultSet.getRow();

    await resultSet.close();
    debugDevData(`${logLabel} row: ${row}`);
    if (row) {
      return recordRowCallback({logLabel, row, metadataPrefix});
    }
  }

  function listRecords(params) {
    return queryRecords(params);
  }

  function listIdentifiers(params) {
    return queryRecords({
      ...params,
      includeRecords: false
    });
  }

  function queryRecords({
    logLabel,
    connection, from, until, set, metadataPrefix, cursor, timeCursor, lastCount,
    includeRecords = true
  }) {
    debugDev(`${logLabel} queryRecords`);
    logger.debug(`${logLabel} We got a from: ${from}, until: ${until}, set ${set}, metaDataPrefix ${metadataPrefix}, cursor: ${cursor}, timeCursor: ${timeCursor}`);
    const params = getParams();
    // Do not strigingify params there is a circularity in connection!
    //debugDev(`${logLabel} params: ${JSON.stringify(params)}`);
    return executeQuery(params);

    function getParams() {
      const setIndexes = indexes[set];
      const startTime = from ? from.local() : from;
      const endTime = until ? until.local() : until;

      const rowCallback = row => recordRowCallback({
        logLabel, row, includeRecords, metadataPrefix
      });

      logger.debug(`${logLabel} We got a indexes: ${JSON.stringify(indexes)}, startTime: ${startTime}, endTime ${endTime}`);
      return {
        logLabel,
        rowCallback, connection, cursor, timeCursor, lastCount,
        genQuery: (cursor, timeCursor) => getRecords({cursor, timeCursor, startTime, endTime, indexes: setIndexes})
      };
    }

    async function executeQuery({logLabel, connection, genQuery, rowCallback, cursor, timeCursor, lastCount}) {
      debugDev(`${logLabel} executeQuery`);
      const resultSet = await doQuery(cursor, timeCursor);
      debugDev(`${logLabel} We got a resultSet`);
      const {records, newCursor, newTimeCursor} = await pump();

      await resultSet.close();

      if (records.length < maxResults) {
        debugDev(`${logLabel} No results left after this, not returning cursors`);
        return {records, lastCount};
      }

      debugDev(`${logLabel} There are results left, returning cursors`);
      return {
        records, lastCount,
        cursor: newCursor,
        timeCursor: newTimeCursor
      };

      async function doQuery(cursor, timeCursor) {
        debugDev(`${logLabel} doQuery`);
        const {query, args} = getQuery(genQuery(cursor, timeCursor), logLabel);
        const {resultSet} = await connection.execute(query, args, {resultSet: true});
        return resultSet;
      }

      async function pump(records = [], rowCount = 0) {
        debugDev(`${logLabel} pump: ${rowCount}`);
        const row = await resultSet.getRow();

        // DEVELOP: check that we get ties when running a timed query

        if (row) {
          const newRowCount = rowCount + 1;
          logRows(newRowCount, logLabel);
          const result = rowCallback(row);

          // Do we need this? Our queries have a limit?
          // Some kind of sanity check for cases where query returns far too much stuff?
          const overFlowLimit = maxResults + 100;
          if (records.length + 1 === overFlowLimit) {
            debugDev(`${logLabel} maxResults ${maxResults / overFlowLimit} reached`);
            return genResults(records.concat(result));
          }

          return pump(records.concat(result), newRowCount);
        }

        if (records.length > 0) {
          return genResults(records);
        }

        // empty array
        return {records};

        function genResults(records) {
          debugDev(`${logLabel} genResults`);
          debug(`${logLabel} We have ${records.length} records`);
          // Because of some Infernal Intervention, sometimes the rows are returned in wrong order (i.e. 000001100 before 000001000). Not repeatable using SQLplus with exact same queries...
          // Do we need this sort, when we have sort in query? No we dont (and timed queries should be sorted by time anywyas)
          /*
          function sortRecords(records) {
            if (from || until) {
              return records;
            }
            return records;
            //return [...records].sort(({id: a}, {id: b}) => Number(a) - Number(b));
          }

          // NOTE: if we want to sort we should sort on time if we have timebased query
          const sortedRecords = sortRecords(records);
          */
          const lastId = toAlephId(records.slice(-1)[0].id);
          // let's keep the time string as it is - but it's not a string, it's already converted to time ...
          const lastTimeStr = records.slice(-1)[0].timeCursor;
          debug(`${logLabel} We have ${lastId} as last ID`);
          debug(`${logLabel} We have ${lastTimeStr} as last time`);

          return {
            records,
            newCursor: lastId,
            newTimeCursor: lastTimeStr
          };
        }
      }
    }
  }

  function recordRowCallback({logLabel, row, metadataPrefix, includeRecords = true}) {
    debugDev(`${logLabel} recordRowCallback`);
    //debugDev(row);

    // Parse record, validate, but do not throw (yet) for validationErrors (validate:1, noFailValidation:1)
    // see validationOptions used in record.js: parseRecord
    const record = handleParseRecord(true, true);
    const isDeleted = isDeletedRecord(record);

    const validationErrors = record.getValidationErrors();
    debugDev(`${logLabel} validationErrors: ${JSON.stringify(validationErrors)}`);

    // We want to include records in response and have an existing record with validationErrors
    // DEVELOP: we should handle erroring records somehow else than with 500!
    // eslint-disable-next-line functional/no-conditional-statements
    if (includeRecords && !isDeleted && validationErrors && validationErrors.length > 0) {
      const errorMessage = `Record ${row.ID} is invalid. ${validationErrors}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // DEVELOP: we return id for records with validationErrors - what should happen?
    if (includeRecords && isDeleted === false) {
      return {
        id: row.ID,
        time: moment.utc(row.TIME, DB_TIME_FORMAT),
        timeCursor: row.TIME,
        record: formatRecord(record, row.ID, metadataPrefix, logLabel)
      };
    }

    return {id: row.ID, time: moment.utc(row.TIME, DB_TIME_FORMAT), timeCursor: row.TIME, isDeleted};

    function handleParseRecord(validate, noFailValidation) {
      debugDev(`${logLabel} recordRowCallback:handleParseRecord`);
      try {
        debugDevData(row);
        return parseRecord({data: row.RECORD, validate, noFailValidation, logLabel});
      } catch (err) {
        // Error here if dbResult row is not convertable to AlephSequential by record.js
        // or AlephSequential is not convertable to marc-record-object
        // or validate:1 && noFailValidation:0 and marc-record-object fails it's validation
        logger.error(`${logLabel} Parsing record ${row.ID} failed.`);
        throw err;
      }
    }
  }

  function getQuery({query, args}, logLabel) {
    debug(`${logLabel ? logLabel : ''} GetQuery`);
    debugQuery(query, args);

    return {
      query,
      args: args || {}
    };

    function debugQuery(query, args) {
      debug(`${logLabel ? logLabel : ''} Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
      //logger.debug(`${logLabel} Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
      logger.verbose(`${logLabel ? logLabel : ''} Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
    }
  }

  function logRows(rowCount, logLabel) {
    if (rowCount === 1 || rowCount % 250 === 0) {
      logger.verbose(`${logLabel} Handling row: ${rowCount}`);
      return;
    }
    if (rowCount % 25 === 0) {
      logger.debug(`${logLabel} Handling row: ${rowCount}`);
      return;
    }
    logger.silly(`${logLabel} Handling row: ${rowCount}`);
  }

}

