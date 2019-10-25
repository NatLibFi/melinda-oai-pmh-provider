
/**
* Copyright 2019 University Of Helsinki (The National Library Of Finland)
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
* limitations under the License.a
*/

import HttpStatus from 'http-status';
import moment from 'moment';
import {Utils} from '@natlibfi/melinda-commons';
import {REQUEST_DATE_STAMP_FORMATS} from '../../constants';
import ApiError from '../../api-error';
import responseFactory from '../response';
import {parseResumptionToken, generateResumptionToken} from '../../utils';
import databaseFactory from './db';

import {
	ERRORS, QUERY_PARAMETERS, METADATA_FORMATS,
} from '../../constants';

export default async ({
	pool, secretEncryptionKey, resumptionTokenTimeout,
	supportEmail, instanceUrl, identifierPrefix, repoName,
	alephLibrary, sets
}) => {
	const {createLogger, clone} = Utils;
	const logger = createLogger();
	const {
		generateErrorResponse, generateIdentifyResponse,
		generateListMetadataFormatsResponse, generateListSetsResponse,
		generateGetRecordResponse, generateListRecordsResponse, generateListIdentifiersResponse
	} = responseFactory({identifierPrefix, supportEmail});
	

	// give connection, sets, maxResults, alephLibrary
	const {
		getRecord, earliestTimestamp,
		listIdentifiers, listRecords
	} = await databaseFactory({});


	return async (req, res, next) => {		
		try {
			await handle();
		} catch (err) {
			return err instanceof ApiError ? sendResponse({error: err.code}) : next(err);
		}
		
		async function handle() {
			const {query: {verb}} = req;
			
			res.type('application/xml');

			const invalidParamsError = validateParams();

			return error ? sendResponse({error}) : call();
			
			function validateParams() {
				const numParams = Object.keys(req.query).length;
				const mapping = {
					GetRecord: validateGetRecord,
					ListMetadataFormats: validateListMetadataFormats,
					ListSets: validateListSets,
					ListIdentifiers: validateListRequest,
					ListRecords: validateListRequest
				};

				return verb ? mapping[verb]() : ERRORS.BAD_VERB;

				function validateGetRecord() {
					return numParams === 2
					? validateMetadataPrefix(req.query.metadataPrefix)
					: ERRORS.BAD_ARGUMENT;
				}

				function validateListMetadataFormats() {
					return numParams === 1 ? undefined
					: numParams === 2 && 'identifier' in req.query
					? validateMetadataPrefix(req.query.identifier) : BAD_ARGUMENT;
				}

				function validateListSets() {
					return numParams === 1 ? undefined
					: numParams === 2 && 'resumptionToken' in req.query
					? undefined : BAD_ARGUMENT;
				}

				function validateListRequest() {
					return numParams === 2 ? check() : ERRORS.BAD_ARGUMENT;

					function check() {
						return 'resumptionToken' in req.query
						? undefined
						: METADATA_FORMATS.find(({prefix}) => prefix === req.query.metadataPrefix)
						? validateOptParams() : ERRORS.CANNOT_DISSEMINATE_FORMAT;

						function validateOptParams() {
							const optParams = ['set', 'from', 'until'];

							return Object.entries(req.query)
							.filter(([k]) => ['verb', 'metadataPrefix'].includes(k) === false)
							.some(([key, value]) => {
								const mapping = {
									'set': validateSet,
									'from': validateTime,
									'until': validateTime
								};

								return key in mapping ? mapping[key]() : true;

								function validateSet() {
									return sets.find(({spec}) => spec === value) === undefined;
								}

								function validateTime() {
									const time = moment.utc(time, REQUEST_DATE_STAMP_FORMATS);
									return time.isValid() === false;
								}
							}) ? ERRORS.BAD_ARGUMENT : undefined;
						}
					}
				}

				function validateMetadataPrefix(target) {
					return METADATA_FORMATS.find(({prefix}) => prefix === target)
					? undefined : ERRORS.CANNOT_DISSEMINATE_FORMAT;
				}
			}
						
			async function call() {
				const method = getMethod();
				const params = getParams();
				const results = await wrap();
				
				return sendResponse({results, params});					
				
				function getMethod() {
					const mapping = {
						Identify: identify,
						ListSets: listSets,
						ListMetadataFormats: listMetadataFormats,
						GetRecord: getRecord,
						ListIdentifiers: listIdentifiers,
						ListRecords: listRecords
					};
					
					return mapping[verb];
				}
				
				function getParams() {
					const params = 'resumptionToken' in req.query ? parseToken() : parse(req.query);
					return needsDb() ? addConnection() : params;
					
					function parseToken() {
						const params = parseResumptionToken({
							secretEncryptionKey, verb,
							token: req.query.resumptionToken								
						});
						
						return parse(params);
					}
					
					function parse(params) {
						return Object.entries(params)						
						.reduce((acc, [key, value]) => {
							const mapping = {
								'from': parseTime,
								'until': parseTime,
								'identifier': parseIdentifier,
							};
							
							return key in mapping ? mapping[key]() : {...acc, [key]: value};
							
							function parseTime() {
								return moment.utc(stamp, REQUEST_DATE_STAMP_FORMATS);
							}
							
							function parseIdentifier() {
								// Strip prefix (Slice takes offset and the length of the prefix doesn't include the separator)
								return value.slice(identifierPrefix.length + 1);
							}
						}, {});
					}
					
					function needsDb() {
						return ['GetRecord', 'ListIdentifiers', 'ListRecords'].includes(verb);
					}
					
					async function addConnection() {
						logger.log('debug', 'Requesting a new connection from the pool...');
						
						const connection = await pool.getConnection();
						
						logger.log('debug', 'Connection acquired!');
						
						return {...params, connection};
					}
					
				}						
				
				async function wrap() {
					return new Promise(async (resolve, reject) => { // eslint-disable-line no-async-promise-executor
						req.on('close', async () => {
							logger.log('info', 'Request cancelled');
							
							if (params.connection) {
								await params.connection.close();
							}
							
							resolve();
						});
						
						try {
							resolve(method(params));
						} catch (err) {
							reject(err);
						} finally {
							params.connection ? await params.connection.close() : undefined;
						}
					});
				}
			}
				
			function listMetadataFormats({identifier}) {
				if (identifier) {
					return METADATA_FORMATS.filter(({prefix}) => prefix === identifier);
				}
				
				return METADATA_FORMATS;
			}
			
			function listSets() {
				return sets.map(({spec, name, description}) => ({spec, name, description}));
			}
		}

}

async function sendResponse({error, result, params}) {
	const query = clone(req.query);
	const requestURL = `${instanceUrl}${req.path}`;
	
	if (error) {
		return res.send(await generateErrorResponse({query, requestURL, error}));
	}
	
	return res.send(await generatePayload(verb));
	
	async function generatePayload(method) {
		const generators = {
			ListSets: async () => generateListSetsResponse({requestURL, query, sets: result}),
			ListRecords: async () => listResources(generateListRecordsResponse),
			ListIdentifiers: async () => listResources(generateListIdentifiersResponse),
			GetRecord: async () => {
				if (result) {
					return generateGetRecordResponse({requestURL, query, ...result});
				}
				
				return generateErrorResponse({requestURL, query, error: ERRORS.ID_DOES_NOT_EXIST});
			},
			ListMetadataFormats: async () => {
				if (result.length === 0) {
					return generateErrorResponse({query, requestURL, error: ERRORS.ID_DOES_NOT_EXIST});
				}
				
				return generateListMetadataFormatsResponse({requestURL, query, formats: result});
			},
			Identify: async () => {
				// Remove the preceding slash
				const descr = REPOSITORY_NAMES[req.path.slice(1)];
				return generateIdentifyResponse({requestURL, query, descr, earliestTimestamp});
			}
		};
		
		return generators[method]();
		
		async function listResources(callback) {
			const {records, cursor, previousCursor} = result;
			
			if (records.length === 0) {
				return generateErrorResponse({query, requestURL, error: ERRORS.NO_RECORDS_MATCH});
			}
			
			if (cursor) {
				const {token, tokenExpirationTime} = generateResumptionToken({
					...params,
					secretEncryptionKey, resumptionTokenTimeout, cursor
				});
				
				return callback({
					requestURL, query, records, token, tokenExpirationTime,
					cursor: previousCursor === undefined ? 0 : previousCursor
				});
			}
			
			return callback({requestURL, query, records});
		}
	}
}
};
};
