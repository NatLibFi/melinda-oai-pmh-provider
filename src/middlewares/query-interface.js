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
* limitations under the License.
*/

import moment from 'moment';
import {Utils} from '@natlibfi/melinda-commons';
import {DB_TIME_FORMAT} from './constants';
import {parseRecord, toAlephId, fromAlephId} from '../record';
import IndexingError from '../indexing-error';

export default async function ({maxResults, sets, queries, connection}) {
	const {createLogger, isDeletedRecord} = Utils;
	const logger = createLogger();
	const {
		getEarliestTimestamp, getHeadingsIndex,
		getRecords, getRecordsTimeframe,
		getRecordsStartTime, getRecordsEndTime, getSingleRecord
	} = queries;
	
	const headingsIndexes = await getHeadingsIndexes();
	const earliestTimestamp = await retrieveEarliestTimestamp();
	
	return {listRecords, listIdentifiers, getRecord, earliestTimestamp};
	
	async function getHeadingsIndexes() {
		if (sets.length === 0) {
			return;
		}
		
		const results = await Promise.all(sets.map(mapIndexes));
		return results.reduce((acc, obj) => ({...acc, ...obj}), {});
		
		async function mapIndexes({spec, headingsIndexes: setIndexes}) {
			const indexes = await Promise.all(setIndexes.map(getIndex));
			return {[spec]: indexes};
			
			async function getIndex(value) {
				debugQuery(getHeadingsIndex, {value});
				
				const {resultSet} = await connection.execute(getHeadingsIndex, {value}, {resultSet: true});
				const row = await resultSet.getRow();
				
				await resultSet.close();
				return `${row.ID}%`;
			}
		}
	}
	
	async function retrieveEarliestTimestamp() {
		debugQuery(getEarliestTimestamp);
		
		const {resultSet} = await connection.execute(getEarliestTimestamp, [], {resultSet: true});
		const row = await resultSet.getRow();
		
		await resultSet.close();
		return moment(row.TIME, 'YYYYMMDDHHmmss');
	}
	
	async function getRecord({connection, identifier, metadataPrefix}) {
		const {query, args} = getSingleRecord({identifier: toAlephId(identifier)});
		
		debugQuery(query, args);
		
		const {resultSet} = await connection.execute(query, args, {resultSet: true});
		const row = await resultSet.getRow();
		
		await resultSet.close();
		
		if (row) {
			return recordRowCallback({
				row,
				formatRecord: generateFormatter(metadataPrefix)
			});
		}
	}
	
	async function listRecords(params) {
		return listResources({
			...params,
			getRecords: true
		});
	}
	
	async function listIdentifiers(params) {
		return queryRecords(params);
	}
	
	async function queryRecords({
		connection, from, until, set, metadataPrefix,
		getRecords = false, cursor = 0
	}) {
		const params = getParams();
		return executeQuery(params);
		
		function getParams() {
			const setIndexes = headingsIndexes[set];
			const start = from;
			const end = until;
			const rowCallback = row => recordRowCallback({
				row, getRecords,
				formatRecord: generateFormatter(metadataPrefix)
			});
			
			if (start && end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => getRecords({cursor, start, end, getRecords, headingsIndexes: setIndexes})
				};
			}
			
			if (start) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => getRecords({cursor, start, getRecords, headingsIndexes: setIndexes})
				};
			}
			
			if (end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => getRecords({cursor, end, getRecords, headingsIndexes: setIndexes})
				};
			}
			
			return {
				rowCallback, connection, cursor,
				genQuery: cursor => getRecords({cursor, getRecords, headingsIndexes: setIndexes})
			};
		}
		
		
		async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			const {query, args} = genQuery(cursor);
			
			debugQuery(query, args);
			
			const {resultSet} = await connection.execute(query, args || [], {resultSet: true});
			
			return pump();
						
			async function pump(results) {
				const row = await resultSet.getRow();
				
				if (row) {
					const result = rowCallback(row);
					return pump(results.concat(result));
				}

				await resultSet.close();

				if (results.length === maxResults) {					
					return {results, cursor: cursor + maxResults}
				}

				return {results};
			}
		}
		
		/*async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			return execute({cursor});
			
			async function execute({records = [], cursor, previousCursor = cursor}) {
				const {query, args} = genQuery(cursor);
				
				debugQuery(query, args);
				
				const {resultSet} = await connection.execute(query, args || [], {resultSet: true});
				
				previousCursor = cursor;
				await pump(resultSet);
				
				if (cursor === previousCursor) {
					return {records};
				}
				
				if (records.length === maxResults) {
					return {records, cursor};
				}
				
				return execute({records, cursor, previousCursor});
				
				async function pump(resultSet) {
					const row = await resultSet.getRow();
					
					if (row) {
						cursor++;
						const result = rowCallback(row);
						
						if (result) {
							records.push(result);
							
							if (records.length === maxResults) {
								await resultSet.close();
								return;
							}
							
							return pump(resultSet);
						}
					}
					
					await resultSet.close();
				}
			}
		}*/		
	}
	
	function recordRowCallback({row, formatRecord, includeRecord = true}) {
		if (row.INDEXING === 'true') {
			throw new IndexingError(row.ID);
		}
		
		const record = parseRecord(row.RECORD);
		
		const isDeleted = isDeletedRecord(record);
		
		if (includeRecord && isDeleted === false) {
			return {
				id: fromAlephId(row.ID),
				time: moment(row.TIME, DB_TIME_FORMAT),
				record: formatRecord(record)
			};
		}
		
		return {id: fromAlephId(row.ID), time: moment(row.TIME, DB_TIME_FORMAT), isDeleted};
	}
	
	function debugQuery(query, args) {
		logger.log('debug', `Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
	}
	
	function generateFormatter(metadataPrefix) {
		return metadataPrefix === 'marc' ?
		formatToStandard :
		r => r;
		
		function formatToStandard(record) {
			// Get all fields with non-numeric tags
			record.get(/[^0-9]+/).forEach(f => record.removeField(f));
			return record;
		}
	}
}

