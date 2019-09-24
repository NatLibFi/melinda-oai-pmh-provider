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

export default ({library, limit}) => {
	const FORMAT_TIME = 'RPAD(CONCAT(z106_update_date, LPAD(z106_time, 4, \'0\')), 12, \'0\')';
	const INDEXING_COLUMN = ', CASE WHEN z07_rec_key IS NULL THEN \'false\' ELSE \'true\' END indexing';

	return {
		singleRecord: ({identifier}) => ({
			query: `SELECT id, time, z00_data record FROM (
						SELECT z00_doc_number id, MAX(${FORMAT_TIME}) time FROM ${library}.z00
						JOIN ${library}.z106 ON z00_doc_number = :identifier AND z106_rec_key = z00_doc_number GROUP BY z00_doc_number
			) JOIN ${library}.z00 ON z00_doc_number = id`,
			args: {identifier}
		}),
		getHeadingsIndex: 'SELECT z01_acc_sequence id FROM fin01.z01 WHERE z01_rec_key like :value',
		getEarliestTimestamp: `SELECT ${FORMAT_TIME} time FROM (
			WITH min AS (
				SELECT MIN(z106_update_date) update_date FROM ${library}.z106
			)
			SELECT min.update_date z106_update_date, MIN(z106_time) z106_time FROM ${library}.z106
				JOIN min ON min.update_date = z106_update_date GROUP BY min.update_date
		)`,
		recordsAll: ({cursor, headingsIndexes}) => ({
			query: `SELECT id, time, z00_data record${headingsIndexes ? `${INDEXING_COLUMN}` : ''} FROM (
				WITH records AS (
					${headingsIndexes ?
				`SELECT z02_doc_number id FROM ${library}.z02 WHERE ${generateHeadingsQueries(headingsIndexes)} OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY` :
				`SELECT z00_doc_number id FROM ${library}.z00 OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
			}					
				)
				SELECT records.id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 JOIN records ON z106_rec_key = records.id GROUP BY id
			)
			${headingsIndexes ? `LEFT JOIN ${library}.z07 ON id = z07_rec_key` : ''}
			JOIN ${library}.z00 ON id = z00_doc_number`
		}),
		recordsTimeframe: ({cursor = 0, start, end, headingsIndexes}) => {
			const startDate = start.format('YYYYMMDD');
			const endDate = end.format('YYYYMMDD');
			const startTime = start.format('HHmm');
			const endTime = end.format('HHmm');

			return {
				args: {startDate, endDate, startTime, endTime},
				query: `SELECT /*+ ORDERED */ id, time, z00_data record${headingsIndexes ? `${INDEXING_COLUMN}` : ''} FROM (
					SELECT z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 WHERE
						(z106_update_date = :startDate AND z106_time >= :startTime) OR
						(z106_update_date = :endTime AND z106_time <= :endTime) OR
						(z106_update_date > :startDate AND z106_update_date < :endDate)
						GROUP BY z106_rec_key OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				)
				${headingsIndexes ? generateHeadingsQueries(headingsIndexes) : ''}
				${headingsIndexes ? `LEFT JOIN ${library}.z07 ON id = z07_rec_key` : ''}	
				JOIN ${library}.z00 ON id = z00_doc_number`
			};
		},
		recordsStartTime: ({cursor = 0, start, headingsIndexes}) => {
			const startDate = start.format('YYYYMMDD');
			const startTime = start.format('HHmm');

			return {
				args: {startDate, startTime},
				query: `SELECT /*+ ORDERED */ id, time, z00_data record${headingsIndexes ? `${INDEXING_COLUMN}` : ''} FROM (
					SELECT z106_rec_key id, MAX(RPAD(CONCAT(z106_update_date, CAST(z106_time AS CHAR(4))), 10, '0')) time FROM fin01.z106 WHERE
						(z106_update_date = ${startDate} AND z106_time >= ${startTime}) OR
						z106_update_date > ${startDate}
						GROUP BY z106_rec_key OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				)
				${headingsIndexes ? generateHeadingsQueries(headingsIndexes) : ''}
				${headingsIndexes ? `LEFT JOIN ${library}.z07 ON id = z02_rec_key` : ''}	
				JOIN ${library}.z00 ON id = z00_doc_number`
			};
		},
		recordsEndTime: ({cursor = 0, end, headingsIndexes}) => {
			const endDate = end.format('YYYYMMDD');
			const endTime = end.format('HHmm');

			return {
				args: {endDate, endTime},
				query: `SELECT /*+ ORDERED */ id, time, z00_data record${headingsIndexes ? `${INDEXING_COLUMN}` : ''} FROM (
					SELECT z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 WHERE
						(z106_update_date = ${endDate} AND z106_time <= ${endTime}) OR
						z106_update_date < ${endDate}
						GROUP BY z106_rec_key OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				)
				${headingsIndexes ? generateHeadingsQueries(headingsIndexes) : ''}
				${headingsIndexes ? `LEFT JOIN ${library}.z07 ON id = z02_rec_key` : ''}	
				JOIN fin01.z00 ON id = z00_doc_number`
			};
		}
	};

	function generateHeadingsQueries(headingsIndexes) {
		return headingsIndexes
			.map(query => `z02_rec_key LIKE '${query}'`)
			.reduce((acc, query, index) => {
				return `${index > 0 ? ' AND ' : ' '}${query}${genTail()}`;

				function genTail() {
					return index < headingsIndexes.length - 1 ? ' AND z02_doc_number = records.id' : '';
				}
			}, `JOIN ${library}.z02 ON`);
	}
};
