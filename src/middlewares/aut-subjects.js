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
				spec: 'topical', name: 'Topical terms',
				description: 'Topical terms',
				indexes: {
					heading: ['HATYPL150 %']
				}
			},
			{
				spec: 'geographic', name: 'Geographic names',
				description: 'Geographic names',
				indexes: {
					heading: ['HATYPL151 %']
				}
			},
			{
				spec: 'genre', name: 'Genre/form terms',
				description: 'Genre/form terms',
				indexes: {
					heading: ['HATYPL155 %']
				}
			},
			{
				spec: 'mediumperf', name: 'Medium of performance terms',
				description: 'Medium of performance terms',
				indexes: {
					heading: ['HATYPL162 %']
				}
			},
			{
				spec: 'topical:yso', name: 'Topical terms (YSO)',
				description: 'YSO - General Finnish ontology',
				indexes: {
					heading: ['HATYPL150 %', 'H040FLYSO FIN %']
				}
			},
			{
				spec: 'geographic:yso', name: 'Geographic names (YSO)',
				description: 'YSO places',
				indexes: {
					heading: ['HATYPL151 %', 'H040FLYSO FIN %']
				}
			},
			{
				spec: 'genre:slm', name: 'Genre/form terms (SLM)',
				description: 'SLM - Suomalainen lajityyppi- ja muotosanasto',
				indexes: {
					heading: ['HATYPL155 %', 'H040FLSLM FIN %']
				}
			}
		];
	}
};
