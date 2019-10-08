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
			/* {
				spec: 'topical', name: 'Topical terms',
				description: 'Topical terms'
			},
			{
				spec: 'geographic', name: 'Geographic names',
				description: 'Geographic names'
			},
			{
				spec: 'genre', name: 'Genre/form terms',
				description: 'Genre/form terms'
			},
			{
				spec: 'mediumperf', name: 'Medium of performance terms',
				description: 'Medium of performance terms'
			} */
		];
	}
};
