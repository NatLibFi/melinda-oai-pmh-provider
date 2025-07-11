

import {Parser, Builder} from 'xml2js';
import {MarcRecord} from '@natlibfi/marc-record';
import createOracleMock from '@natlibfi/oracledb-mock';
import generateTests from '@natlibfi/fixugen-http-server';
import {dbDataStringFromRecord} from './record';
import startApp from '.';

const oracleMock = createOracleMock();

generateTests({
  callback, formatResponse,
  path: [__dirname, '..', '..', 'test-fixtures', 'app']
});

function callback({contextName, isPrivileged, alephLibrary, melindaPrefix, dbResults, sets = []}) {
  oracleMock._clear();
  oracleMock._execute(formatDbResults());

  return startApp({
    httpPort: 1337,
    oracleUsername: 'foo',
    oraclePassword: 'bar',
    oracleConnectString: 'foobar/foo',
    middlewareOptions: {
      sets,
      // Tests will break in the 4th millennium because resumption tokens will expire
      resumptionTokenTimeout: 31536000000000,
      maxResults: 3,
      alephLibrary,
      //alephLibrary: 'foo00',
      instanceUrl: `http://localhost:1337`,
      oaiIdentifierPrefix: 'oai:foo.bar',
      supportEmail: 'foo@foo.bar',
      secretEncryptionKey: '4110c04d8d3f18578e3ba555faf8a4a1d5ab1fa50914f0139afc1445238ac7d2',
      socketTimeout: 0,
      contextOptions: {
        contextName, isPrivileged,
        alephLibrary,
        melindaPrefix
        //alephLibrary: 'foo00',
        //melindaPrefix: 'FI-MELINDA'
      }
    },
    ipWhiteList: []
  }, oracleMock);

  function formatDbResults() {
    return dbResults
      .map(format)
      .reduce((a, v) => [...a, {results: v}], []);

    function format(rows) {
      return rows.map(row => {
        if ('RECORD' in row) {
          // eslint-disable-next-line no-console
          //console.log(`RECORD`);
          return {...row, RECORD: dbDataStringFromRecord(new MarcRecord(row.RECORD, {noFailValidation: true}))};
        }

        return row;
      });
    }
  }
}

async function formatResponse(headers, originalPayload) {
  if (originalPayload) { // eslint-disable-line functional/no-conditional-statements
    try {
      const obj = await parse(originalPayload);
      const modified = format(obj);
      const payload = toString(modified);
      return {headers, payload};
    } catch (err) {
      return {headers, payload: originalPayload};
    }
  }

  return {headers, payload: originalPayload};

  function parse(str) {
    return new Promise((resolve, reject) => {
      new Parser().parseString(str, (err, obj) => err ? reject(err) : resolve(obj));
    });
  }

  function format(obj) {
    const keys = ['ListIdentifiers', 'ListRecords', 'ListSets'];
    if (Object.keys(obj['OAI-PMH']).some(k => keys.includes(k))) {
      const [key, value] = Object.entries(obj['OAI-PMH']).find(([k]) => keys.includes(k));

      // resumptionToken expirationDate and value is always formatted!
      if ('resumptionToken' in value[0]) {
        const modified = standardFormat(obj);

        return {
          ...modified,
          'OAI-PMH': {
            ...modified['OAI-PMH'],
            [key]: [
              {
                ...value[0],
                resumptionToken: [
                  {
                    ...value[0].resumptionToken[0],
                    $: {
                      ...value[0].resumptionToken[0].$,
                      expirationDate: '2000-01-01T00:00:00.000Z'
                    },
                    _: 'foobar'
                  }
                ]
              }
            ]
          }
        };
      }

      return standardFormat(obj);
    }

    return standardFormat(obj);

    function standardFormat(obj) {
      return {
        ...obj,
        'OAI-PMH': {
          ...obj['OAI-PMH'],
          responseDate: ['2000-01-01T00:00:00.000Z']
        }
      };
    }
  }

  function toString(obj) {
    return new Builder({
      xmldec: {
        version: '1.0',
        encoding: 'UTF-8',
        standalone: false
      },
      renderOpts: {
        pretty: true,
        indent: '\t'
      }
    }).buildObject(obj);
  }
}
