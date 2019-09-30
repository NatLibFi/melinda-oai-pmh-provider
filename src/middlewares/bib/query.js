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

import {generateOr} from '../../build-query';

export default ({library, limit}) => {
	const FORMAT_TIME = 'RPAD(CONCAT(z106_update_date, LPAD(z106_time, 4, \'0\')), 12, \'0\')';
	const INDEXING_COLUMN = 'CASE WHEN z07_rec_key IS NULL THEN \'false\' ELSE \'true\' END indexing';

	return {
		getSingleRecord: ({identifier}) => ({
			args: {identifier},
			query: [
				{
					stmt: 'SELECT id, time, z00_data record FROM (',
					sub: [
						`SELECT z00_doc_number id, MAX(${FORMAT_TIME}) time FROM ${library}.z00`,
						`JOIN ${library}.z106 ON z00_doc_number = :identifier AND z106_rec_key = z00_doc_number GROUP BY z00_doc_number`
					]
				},
				`) JOIN ${library}.z00 ON z00_doc_number = id`
			]
		}),
		getHeadingsIndex: ({value}) => ({
			query: [
				`SELECT z01_acc_sequence id FROM ${library}.z01 WHERE z01_rec_key like :value`
			],
			args: {value}
		}),
		getEarliestTimestamp: () => ({
			query: [
				{
					stmt: `SELECT ${FORMAT_TIME} time FROM (`,
					sub: [
						{
							stmt: 'WITH min AS (',
							sub: [
								`SELECT MIN(z106_update_date) update_date FROM ${library}.z106`
							]
						},
						')',
						`SELECT min.update_date z106_update_date, MIN(z106_time) z106_time FROM ${library}.z106`,
						'JOIN min ON min.update_date = z106_update_date GROUP BY min.update_date'
					]
				},
				')'
			]
		}),
		getRecords: ({cursor = 0, start, end, headingsIndexes}) => {
			return {
				args: getArgs(),
				query: build()
			};

			function getArgs() {
				const obj = {};

				if (start) {
					obj.startDate = start.format('YYYYMMDD');
					obj.startTime = start.format('HHmm');
				}

				if (end) {
					obj.endDate = end.format('YYYYMMDD');
					obj.endTime = end.format('HHmm');
				}

				return obj;
			}

			function build() {
				const obj = [
					{
						stmt: `SELECT id, time, z00_data record${headingsIndexes ? `, ${INDEXING_COLUMN}` : ''} FROM (`,
						sub: [
							{
								stmt: `SELECT /*+ ORDERED */ z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106`,
								sub: generateConditions().concat([
									'GROUP BY z106_rec_key',
									`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`

								])
							}
						]
					},
					')'
				];

				if (headingsIndexes) {
					obj.push(`LEFT JOIN ${library}.z07 ON id = z07_rec_key`);
				}

				obj.push(`JOIN ${library}.z00 ON id = z00_doc_number`);

				return obj;
			}

			function generateConditions() {
				const statements = [];

				if (headingsIndexes) {
					const conditions = headingsIndexes
						.map(query => `z02_rec_key LIKE '${query}'`);

					statements.push({
						stmt: `JOIN ${library}.z02 ON`,
						sub: [
							`z02_doc_number = z106_rec_key AND ${generateOr(conditions)}`
						]
					});
				}

				if (start || end) {
					const conditions = [];

					if (start) {
						conditions.push('(z106_update_date = :startDate AND z106_time >= :startTime)');
					}

					if (end) {
						conditions.push('(z106_update_date = :endDate AND z106_time <= :endTime)');
					}

					if (start && end) {
						conditions.push('(z106_update_date > :startDate AND z106_update_date < :endDate)');
					}

					statements.push({
						stmt: 'WHERE',
						sub: generateOr(conditions, true)
					});
				}

				return statements;
			}
		}
	};
};
