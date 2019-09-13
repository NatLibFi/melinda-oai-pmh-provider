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
	const FORMAT_TIME = 'RPAD(CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))), 10, \'0\')';

	return {
		singleRecord: ({identifier}) => ({
			query: `SELECT id, time, z00_data record FROM (
						SELECT z00_doc_number id, MAX(${FORMAT_TIME}) time FROM ${library}.z00
						JOIN ${library}.z106 ON z00_doc_number = :identifier AND z106_rec_key = z00_doc_number GROUP BY z00_doc_number
			) JOIN ${library}.z00 ON z00_doc_number = id`,
			args: {identifier}
		}),
		earliestTimestamp: `SELECT ${FORMAT_TIME} time FROM (
			WITH min AS (
				SELECT MIN(z106_update_date) update_date FROM ${library}.z106
			)
			SELECT min.update_date z106_update_date, MIN(z106_time)z106_time FROM ${library}.z106
				JOIN min ON min.update_date = z106_update_date GROUP BY min.update_date
		)`,
		recordsAll: ({cursor}) => ({
			query: `SELECT id, time, z00_data record FROM (
				WITH records AS (
					SELECT z00_doc_number id FROM ${library}.z00 OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				)
				SELECT records.id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 JOIN records ON z106_rec_key = records.id GROUP BY id
			) JOIN ${library}.z00 ON id = z00_doc_number`
		}),
		recordsTimeframe: ({cursor = 0, start, end}) => {
			const startDate = start.format('YYYYMMDD');
			const endDate = end.format('YYYYMMDD');
			const startTime = start.format('HHmm');
			const endTime = end.format('HHmm');

			return {
				args: {startDate, endDate, startTime, endTime},
				query: `SELECT id, time, z00_data record FROM (
					SELECT /*+ ORDERED */ z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 WHERE
						(z106_update_date = :startDate AND z106_time >= :startTime) OR
						(z106_update_date = :endTime AND z106_time <= :endTime) OR
						(z106_update_date > :startDate AND z106_update_date < :endDate)
						GROUP BY z106_rec_key OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				) JOIN ${library}.z00 ON id = z00_doc_number`
			};
		},
		recordsStartTime: ({cursor = 0, start}) => {
			const startDate = start.format('YYYYMMDD');
			const startTime = start.format('HHmm');

			return {
				args: {startDate, startTime},
				query: `SELECT id, time, z00_data record FROM (
					SELECT /*+ ORDERED */ z106_rec_key id, MAX(RPAD(CONCAT(z106_update_date, CAST(z106_time AS CHAR(4))), 10, '0')) time FROM fin01.z106 WHERE
						(z106_update_date = ${startDate} AND z106_time >= ${startTime}) OR
						z106_update_date > ${startDate}
						GROUP BY z106_rec_key OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				) JOIN ${library}.z00 ON id = z00_doc_number`
			};
		},
		recordsEndTime: ({cursor = 0, end}) => {
			const endDate = end.format('YYYYMMDD');
			const endTime = end.format('HHmm');

			return {
				args: {endDate, endTime},
				query: `SELECT id, time, z00_data record FROM (
					SELECT /*+ ORDERED */ z106_rec_key id, MAX(${FORMAT_TIME}) time FROM ${library}.z106 WHERE
						(z106_update_date = ${endDate} AND z106_time <= ${endTime}) OR
						z106_update_date < ${endDate}
						GROUP BY z106_rec_key OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
				) JOIN fin01.z00 ON id = z00_doc_number`
			};
		}
	};
};
