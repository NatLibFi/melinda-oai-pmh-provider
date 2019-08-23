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

export default ({z106Library, z115Library, limit}) => {
	return {
		record: `SELECT z00_doc_number id, z00_data record FROM ${z106Library}.z00_data`,
		// Identifiers: ({limit, cursor = 0}) => {
		identifiers: ({cursor = 0}) => {
			const startId = String(cursor).padStart(9, '0');
			const endId = String(cursor + limit).padStart(9, '0');

			return {
				query: `SELECT id, MAX(time) time FROM (
                            WITH records AS (
                                SELECT z00_doc_number id FROM ${z106Library}.z00 WHERE z00_doc_number >= :startId AND z00_doc_number <= :endId
                            )
                            SELECT records.id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106
                                RIGHT JOIN records ON z106_rec_key = records.id
                            UNION
                            SELECT records.id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115
                                RIGHT JOIN records ON z115_tab = records.id
                ) GROUP BY id ORDER BY id`,
				args: {startId, endId}
			};
		},
		// IdentifiersTimeframe: ({limit, cursor = 0, start, end}) => {
		identifiersTimeframe: ({cursor = 0, start, end}) => {
			const startDate = start.format('YYYYMMDD');
			const endDate = end.format('YYYYMMDD');
			const z106StartTime = start.format('HHmm');
			const z106EndTime = end.format('HHmm');
			const z115StartTime = start.format('HHmm000000');
			const z115EndTime = end.format('HHmm000000');
			return {
				query: `SELECT id, MAX(time) time FROM (
                            SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106 WHERE
                                (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                                (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                                (z106_update_date > :startDate AND z106_update_date < :endDate)
                            UNION
                            SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115 WHERE
                                (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                                (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                                (z115_today_date > :startDate AND z115_today_date < :endDate)
                        ) GROUP BY id ORDER BY id ASC OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`,
				args: {startDate, endDate, z106StartTime, z106EndTime, z115StartTime, z115EndTime}
			};
		},
		// IdentifiersStartTime: ({limit, cursor = 0, start}) => {
		identifiersStartTime: ({cursor = 0, start}) => {
			const startDate = start.format('YYYYMMDD');
			const z106StartTime = start.format('HHmm');
			const z115StartTime = start.format('HHmm000000');
			return {
				query: `SELECT id, MAX(time) time FROM (
                            SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106 WHERE
                                (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                                z106_update_date > :startDate
                            UNION
                            SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115 WHERE
                                (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                                z115_today_date > :startDate
                        ) GROUP BY id ORDER BY id ASC OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`,
				args: {startDate, z106StartTime, z115StartTime}
			};
		},
		// IdentifiersEndTime: ({limit, cursor = 0, end}) => {
		identifiersEndTime: ({cursor = 0, end}) => {
			const endDate = end.format('YYYYMMDD');
			const z106EndTime = end.format('HHmm');
			const z115EndTime = end.format('HHmm000000');

			return {
				query: `SELECT id, MAX(time) time FROM (
                            SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106 WHERE
                                (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                                z106_update_date < :endDate
                            UNION
                            SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115 WHERE
                                (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                                z115_today_date < :endDate
                        ) GROUP BY id ORDER BY id ASC OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`,
				args: {endDate, z106EndTime, z115EndTime}
			};
		},
		// RecordsAll: ({limit, cursor}) => {
		recordsAll: ({cursor}) => {
			const startId = String(cursor).padStart(9, '0');
			const endId = String(cursor + limit).padStart(9, '0');

			return {
				query: `SELECT id, time, z00_data data FROM (
                            SELECT id, max(time) time FROM (
                                WITH records AS (
                                    SELECT z00_doc_number id, z00_data data FROM ${z106Library}.z00 WHERE z00_doc_number >= :startId AND z00_doc_number <= :endId
                                )
                                SELECT records.id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106
                                    RIGHT JOIN records ON z106_rec_key = records.id
                                UNION
                                SELECT records.id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115
                                    RIGHT JOIN records ON z115_tab = records.id
                            ) GROUP BY id ORDER BY id
                        ) JOIN ${z106Library}.z00 ON id = z00_doc_number`,
				args: {startId, endId}
			};
		},
		// RecordsTimeframe: ({limit, cursor = 0, start, end}) => {
		recordsTimeframe: ({cursor = 0, start, end}) => {
			const startDate = start.format('YYYYMMDD');
			const endDate = end.format('YYYYMMDD');
			const z106StartTime = start.format('HHmm');
			const z106EndTime = end.format('HHmm');
			const z115StartTime = start.format('HHmm000000');
			const z115EndTime = end.format('HHmm000000');

			return {
				query: `SELECT id, time, z00_data record FROM (
                    SELECT id, MAX(time) time FROM (
                        SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106 WHERE
                            (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                            (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                            (z106_update_date > :startDate AND z106_update_date < '20190117')
                        UNION
                        SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115 WHERE
                            (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                            (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                            (z115_today_date > :startDate AND z115_today_date < :endDate)
                    ) GROUP BY id ORDER BY id ASC OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
                ) JOIN ${z106Library}.z00 ON id = z00_doc_number`,
				args: {startDate, endDate, z106StartTime, z106EndTime, z115StartTime, z115EndTime}
			};
		},
		// RecordsStartTime: ({limit, cursor = 0, start}) => {
		recordsStartTime: ({cursor = 0, start}) => {
			const startDate = start.format('YYYYMMDD');
			const z106StartTime = start.format('HHmm');
			const z115StartTime = start.format('HHmm000000');

			return {
				query: `SELECT id, time, z00_data record FROM (
                    SELECT id, MAX(time) time FROM (
                        SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106 WHERE
                            (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                            z106_update_date > :startDate
                        UNION
                        SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115 WHERE
                            (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                            z115_today_date > :startDate
                    ) GROUP BY id ORDER BY id ASC OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
                ) JOIN ${z106Library}.z00 ON id = z00_doc_number`,
				args: {startDate, z106StartTime, z115StartTime}
			};
		},
		// RecordsEndTime: ({limit, cursor = 0, end}) => {
		recordsEndTime: ({cursor = 0, end}) => {
			const endDate = end.format('YYYYMMDD');
			const z106EndTime = end.format('HHmm');
			const z115EndTime = end.format('HHmm000000');

			return {
				query: `SELECT id, time, z00_data record FROM (
                    SELECT id, MAX(time) time FROM (
                        SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${z106Library}.z106 WHERE
                            (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                            z106_update_date < :endDate
                        UNION
                        SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${z115Library}.z115 WHERE
                            (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                            z115_today_date < :endDate)
                    ) GROUP BY id ORDER BY id ASC OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY
                ) JOIN ${z106Library}.z00 ON id = z00_doc_number`,
				args: {endDate, z106EndTime, z115EndTime}
			};
		}
	};
};
