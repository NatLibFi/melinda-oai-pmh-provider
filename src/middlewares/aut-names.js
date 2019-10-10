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
				spec: 'personal', name: 'Personal names',
				description: 'Personal names',
				indexes: {
					heading: ['HATYPL100A %']
				}
			},
			{
				spec: 'corporate', name: 'Corporate names',
				description: 'Corporate names',
				indexes: {
					heading: ['HATYPL110A %']
				}
			},
			{
				spec: 'meetings', name: 'Meeting names',
				description: 'Meeting names',
				indexes: {
					heading: ['HATYPL111A %']
				}
			}
		];
	}
};
