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

// import {generateOr, generateAnd} from '../build-query';

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
		getRecords: ({cursor = 0, start, end, indexes}) => {			
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
				if (start || end) {
					return buildTimeLimitedQuery();
				}

				return [
					{
						stmt: `SELECT id, time, z00_data record${indexing ? 'indexing' : ''} FROM (`
					},
					`) JOIN ${library}.z00 ON z00_doc_number = id`
				]
				
				function buildTimeLimitedQuery() {									
					const x = [
						{
							stmt: `SELECT id, time, z00_data record${indexing.heading ? `, ${INDEXING_COLUMN}` : ''} FROM (`,
							sub: [
								{
									stmt: `SELECT z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106`,
									sub: [
										{
											stmt: 'WHERE',
											sub: conditions
										},
										'GROUP BY z106_rec_key'
									]
								}
							]
						},
						')',
						`JOIN ${library}.z00 ON id = z00_doc_number`
					];
					
					if (indexing) {
						const statements = genIndexingStatements();

						return x.concat(
							statements,
							`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
						);						
					}

					function genIndexingStatements(indexing, idColumn) {
						const statements = Object.entries(indexing).reduce((acc, [type, values, index]) => {
							if (type === 'heading') {
								return acc.concat(values.map((value, index) => 
									`JOIN ${library}.z02 h${index} ON id = i${index}.z02_doc_number AND (i${index}.z02_rec_key like '${value}')`
								));
							}
							
							if (type === 'direct') {
								return acc.concat(values.map((value, index) => 
									`JOIN ${library}.z11 d${index} ON id = i${index}.z11_doc_number AND (i${index}.z11_rec_key like '${value}')`
								));
							}

							return acc;
						}, []);

						if (indexing.heading) {
							return statements.concat(`LEFT JOIN ${library}.z07 ON id = z07_rec_key AND z07_sequence NOT LIKE '3018%'`);
						}

						return statements;
					}

					function genConditions() {
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
							sub: generateOr({conditions, toSub: true})
						});						
					}
				}
				
				
				return [
					{
						stmt: `SELECT id, time, z00_data record${useHeadingIndexes ? `, ${INDEXING_COLUMN}` : ''} FROM (`,
						sub: [
							{
								stmt: `SELECT z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 `,
								sub: [
									{
										stmt: 'WHERE',
										sub: [
											`z106_library = ${library.toUpperCase()} AND (`
											`(z106_update_date = :startDate AND z106_time >= :startTime) OR`,
											`(z106_update_date = :endDate AND z106_time <= :endTime) OR`,
											`(z106_update_date > :startDate AND z106_update_date < :endDate)`,
											')'
										]
									},
									'GROUP BY z106_rec_key'
								]
							}
						]
					},
					`) JOIN ${library}.z00 ON id = z00_doc_number`,
					(useHeadingIndexes ? `JOIN ${library}.z02 x1 ON id = x1.z02_doc_number AND (x1.z02_rec_key like '012100156%')
					JOIN ${library}.z02 x2 ON id = x2.z02_doc_number AND (x2.z02_rec_key like '034100447%')`: ''),
					(useDirectIndexes ? `JOIN ${library}.z11 ON z00_doc_number = z11_doc_number AND z11_rec_key LIKE 'SIDA %helme                                                                    _________'
					` : ''),
					(useHeadingIndexes ? `LEFT JOIN ${library}.z07 ON id = z07_rec_key AND z07_sequence NOT LIKE '3018%'` : ''),
					`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
				];
			}
			
			
			const obj = [
				{
					stmt: `SELECT id, time, z00_data record, ${INDEXING_COLUMN} FROM (`,
					sub: [
						{
							stmt: 'SELECT id, MAX(time) time FROM (',
							sub: [
								{
									stmt: `SELECT /*+ ORDERED */ z106_rec_key id, ${FORMAT_TIME} time FROM ${library}.z106`,
									sub: [
										`JOIN ${library}.z00 ON z106_rec_key = z00_doc_number`,
										`JOIN ${library}.z02 x1 ON z106_rec_key = x1.z02_doc_number AND (x1.z02_rec_key like '012100156%')`,
										`JOIN ${library}.z02 x2 ON z106_rec_key = x2.z02_doc_number AND (x2.z02_rec_key like '034100447%')`,
										{
											stmt: 'WHERE',
											sub: [
												'(z106_update_date = \'20190928\' AND z106_time >= 0800) OR',
												'(z106_update_date = \'20191001\' AND z106_time <= 1200) OR',
												'(z106_update_date > \'20190928\' AND z106_update_date < \'20191001\')'
											]
										},
										`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
									]
								}
							]
						},
						') GROUP BY id'
					]
				},
				`) LEFT JOIN ${library}.z07 ON id = z07_rec_key AND z07_sequence NOT LIKE '3018%'`,
				`JOIN ${library}.z00 ON id = z00_doc_number`
			];
			
			return obj;
			
			//				Const obj = [
			//					{
			//						stmt: `SELECT /*+ ORDERED */ id, time, z00_data record${headingsIndexes ? `, ${INDEXING_COLUMN}` : ''} FROM (`,
			//						sub: [
			//							{
			//								stmt: `SELECT z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106`,
			//								sub: [
			//									`JOIN ${library}.z00 ON z106_rec_key = z00_doc_number`
			//								].concat(
			//									generateConditions(),
			//									[
			//										'GROUP BY z106_rec_key',
			//										`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
			//									]
			//								)
			//							}
			//						]
			//					},
			//					')'
			//				];
			//
			//				if (headingsIndexes) {
			//					obj.push(`LEFT JOIN ${library}.z07 ON id = z07_rec_key`);
			//				}
			//
			//				obj.push(`JOIN ${library}.z00 ON id = z00_doc_number`);
			//
			//				return obj;
			//
			//				function generateConditions() {
			//					const statements = [];
			//
			//					if (headingsIndexes) {
			//						const conditions = headingsIndexes
			//							.map(query => `z02_rec_key LIKE '${query}'`);
			//
			//						statements.push({
			//							stmt: `JOIN /*+ ORDERED */ ${library}.z02 ON`,
			//							sub: [
			//								`z02_doc_number = z106_rec_key AND ${generateAnd({conditions})}`
			//							]
			//						});
			//					}
			//
			//					if (start || end) {
			//						const conditions = [];
			//
			//						if (start) {
			//							conditions.push('(z106_update_date = :startDate AND z106_time >= :startTime)');
			//						}
			//
			//						if (end) {
			//							conditions.push('(z106_update_date = :endDate AND z106_time <= :endTime)');
			//						}
			//
			//						if (start && end) {
			//							conditions.push('(z106_update_date > :startDate AND z106_update_date < :endDate)');
			//						}
			//
			//						statements.push({
			//							stmt: 'WHERE',
			//							sub: generateOr({conditions, toSub: true})
			//						});
			//					}
			//
			//					return statements;
			//				}
		}
	}
};
};
