/**
* Copyright 2019-2020 University Of Helsinki (The National Library Of Finland)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

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
        const [value] = values;

        if (value) {
          if ([value] in cache) {
            return getHeadingIndexes(values.slice(1), results.concat(cache[value]));
          }

          const {query, args} = getQuery(getHeadingsIndex({value}));
          const {resultSet} = await connection.execute(query, args, {resultSet: true});
          const row = await resultSet.getRow();

          await resultSet.close();

          cache[value] = `${row.ID}%`; // eslint-disable-line functional/immutable-data, require-atomic-updates
          return getHeadingIndexes(values.slice(1), results.concat(cache[value]));
        }

        return results;
      }
    }
  }

  async function retrieveEarliestTimestamp() {
    const {query, args} = getQuery(getEarliestTimestamp());

    const {resultSet} = await connection.execute(query, args, {resultSet: true}); 
    const row = await resultSet.getRow();

    await resultSet.close();
    return moment.utc(row.TIME, DB_TIME_FORMAT);
  }

  async function getRecord({connection, identifier, metadataPrefix}) {
    debuDev(`getRecord`);
    const {query, args} = getQuery(getSingleRecord({identifier: toAlephId(identifier)}));
    const {resultSet} = await connection.execute(query, args, {resultSet: true});
    debugDev(`resultSet: ${JSON.stringify(resultSet)}`);
    const row = await resultSet.getRow();

    await resultSet.close();
    debugDev(`row: ${row}`);
    if (row) {
      return recordRowCallback({row, metadataPrefix});
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
    connection, from, until, set, metadataPrefix, cursor, lastCount,
    includeRecords = true
  }) {
    debugDev(`queryRecords`);
    const params = getParams();
    return executeQuery(params);

    function getParams() {
      const setIndexes = indexes[set];
      const startTime = from ? from.local() : from;
      const endTime = until ? until.local() : until;

      const rowCallback = row => recordRowCallback({
        row, includeRecords, metadataPrefix
      });

      return {
        rowCallback, connection, cursor, lastCount,
        genQuery: cursor => getRecords({cursor, startTime, endTime, indexes: setIndexes})
      };
    }

    async function executeQuery({connection, genQuery, rowCallback, cursor, lastCount}) {
      debugDev(`executeQuery`);
      const resultSet = await doQuery(cursor);
      debugDev(`We got a resultSet`);
      const {records, newCursor} = await pump();

      await resultSet.close();

      if (records.length < maxResults) {
        debugDev(`No results left after this, not returning a cursor`);
        return {records, lastCount};
      }

      debugDev(`There are results left, returning a cursor`);
      return {
        records, lastCount,
        cursor: newCursor
      };

      async function doQuery(cursor) {
        debugDev(`doQuery`);
        const {query, args} = getQuery(genQuery(cursor));
        const {resultSet} = await connection.execute(query, args, {resultSet: true});
        return resultSet;
      }

      async function pump(records = []) {
        debugDevDev(`pump`);
        const row = await resultSet.getRow();

        if (row) {
          const result = rowCallback(row);

          if (records.length + 1 === maxResults) {
            debugDev(`maxResults ${maxResults} reached`);
            return genResults(records.concat(result));
          }

          return pump(records.concat(result));
        }

        if (records.length > 0) {
          return genResults(records);
        }

        return {records};

        function genResults(records) {
          debugDev(`genResults`);
          debug(`We have ${records.length} records`);
          // Because of some Infernal Intervention, sometimes the rows are returned in wrong order (i.e. 000001100 before 000001000). Not repeatable using SQLplus with exact same queries...
          const sortedRecords = [...records].sort(({id: a}, {id: b}) => Number(a) - Number(b));

          const lastId = sortedRecords.slice(-1)[0].id;
          debug(`We have ${lastId} as last ID`);

          return {
            records: sortedRecords,
            newCursor: toAlephId(lastId)
          };
        }
      }
    }
  }

  function recordRowCallback({row, metadataPrefix, includeRecords = true}) {
    debugDev(`recordRowCallback`);
    debugDev(row);

    // Parse record, validate, but do not throw (yet) for validationErrors (validate:1, noFailValidation:1)
    // see validationOptions used in record.js: parseRecord
    const record = handleParseRecord(true, true);
    const isDeleted = isDeletedRecord(record);

    const validationErrors = record.getValidationErrors();
    debugDev(`validationErrors: ${JSON.stringify(validationErrors)}`);

    // We want to include records in response and have an existing record with validationErrors
    // DEVELOP: we should handle erroring records somehow else than with 500!
    // eslint-disable-next-line functional/no-conditional-statements
    if (includeRecords && !isDeleted && validationErrors && validationErrors.length > 0) {
      const errorMessage = `Record ${row.ID} is invalid. ${validationErrors}`;
      logger.log('error', errorMessage);
      throw new Error(errorMessage);
    }

    // DEVELOP: we return id for records with validationErrors - what should happen?
    if (includeRecords && isDeleted === false) {
      return {
        id: row.ID,
        time: moment.utc(row.TIME, DB_TIME_FORMAT),
        record: formatRecord(record, row.ID, metadataPrefix)
      };
    }

    return {id: row.ID, time: moment.utc(row.TIME, DB_TIME_FORMAT), isDeleted};

    function handleParseRecord(validate, noFailValidation) {
      debugDev(`recordRowCallback:handleParseRecord`);
      try {
        debugDev(row);
        return parseRecord(row.RECORD, validate, noFailValidation);
      } catch (err) {
        // Error here if dbResult row is not convertable to AlephSequential by record.js
        // or AlephSequential is not convertable to marc-record-object
        // or validate:1 && noFailValidation:0 and marc-record-object fails it's validation
        logger.log('error', `Parsing record ${row.ID} failed.`);
        throw err;
      }
    }
  }

  function getQuery({query, args}) {
    debugQuery(query, args);

    return {
      query,
      args: args || {}
    };

    function debugQuery(query, args) {
      logger.log('debug', `Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
    }
  }
}

