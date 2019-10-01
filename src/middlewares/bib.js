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

import createInterface from './interface';

export default params => {
	return createInterface(params, generateSets());

	function generateSets() {
		return [
			{
				spec: 'fennica', name: 'Fennica',
				description: 'The Finnish national bibliography',
				headingsIndexes: ['LOW  LFIKKA%', 'H042 LFINB %']
			},
			{
				spec: 'viola', name: 'Viola',
				description: 'The Finnish national discography',
				headingsIndexes: ['LOW  LFIKKA%', 'H042 LFINBD%']
			},
			{
				spec: 'arto', name: 'Arto',
				description: 'Finnish periodical and monograph articles',
				headingsIndexes: ['H960 LARTO%']
			},
			/* {
				spec: 'gmc', name: 'GMC',
				description: 'Global Music Centre'
			}, */
			{
				spec: 'monographic', name: 'Monographic records',
				description: 'Monographic records',
				headingsIndexes: ['HBL  LM %']
			},
			{
				spec: 'serial', name: 'Serial records',
				description: 'Serial records',
				headingsIndexes: ['HBL  LS %']
			},
			{
				spec: 'monographic:fennica', name: 'Monographic records (Fennica)',
				description: 'The Finnish national bibliograpy - Monographic records',
				headingsIndexes: ['LOW  LFIKKA%', 'H042 LFINB %', 'HBL  LM %']
			},
			{
				spec: 'serial:fennica', name: 'Serial records (Fennica)',
				description: 'The Finnish national bibliograpy - Serial records',
				headingsIndexes: ['LOW  LFIKKA%', 'H042 LFINB %', 'HBL  LS %']
			}
		];
	}
};
