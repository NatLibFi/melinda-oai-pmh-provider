

import {expect} from 'chai';
import generateTests from '@natlibfi/fixugen';
import {READERS} from '@natlibfi/fixura';
//import {MarcRecord} from '@natlibfi/marc-record';
//import query from './query.js';
import queryFactory from './query';
import createDebugLogger from 'debug';
import moment from 'moment';
import {requestDateStampFormats} from '../constants';


const debug = createDebugLogger('@natlibfi/melinda-rest-oai-pmh-provider:db:query:test');
const debugData = debug.extend('data');

describe('query', () => {
  generateTests({
    path: [__dirname, '..', '..', '..', '..', 'test-fixtures', 'middleware', 'db', 'query'],
    useMetadataFile: true,
    recurse: false,
    fixura: {
      reader: READERS.JSON
    },
    callback: ({alephLibrary = 'foo00', maxResults = 100, testFunction, params, indexes = {}, expectedResult, expectedToThrow = false, expectedErrorMessage}) => {
      const {getEarliestTimestamp, getHeadingsIndex, getRecords, getSingleRecord} = queryFactory({
        library: alephLibrary, limit: maxResults
      });

      try {
        debug(testFunction);
        const functionToTest = getFunction(testFunction);
        // we'll need to format startTime and endTime params before handing them to test
        const newParams = {
          ...params,
          startTime: params?.startTime ? parseTime(params.startTime) : undefined,
          endTime: params?.endTime ? parseTime(params.endTime) : undefined,
          indexes
        };

        const result = functionToTest(newParams);
        debugData(result);
        //expect(JSON.stringify(result)).to.equal(JSON.stringify(expectedResult));
        expect(result).to.eql(expectedResult);
        //expect(result.args).to.equal(expectedResult.args);
      } catch (err) {
        if (expectedToThrow) {
          debugData(`ERROR! ${err.message}`);
          debug(`Expected to throw, OK`);
          expect(err.message).to.equal(expectedErrorMessage);
          return;
        }
        debug(`Not expected to throw`);
        throw err;
      }


      function parseTime(stamp) {
        debug(`parsing: ${stamp}`);
        return moment.utc(stamp, requestDateStampFormats);
      }

      function getFunction(testFunction) {
        if (testFunction === 'getEarliestTimestamp') {
          return getEarliestTimestamp;
        }
        if (testFunction === 'getHeadingsIndex') {
          return getHeadingsIndex;
        }
        if (testFunction === 'getRecords') {
          return getRecords;
        }
        if (testFunction === 'getSingleRecord') {
          return getSingleRecord;
        }
        throw new Error(`Unknown function`);
      }
    }
  });
});
