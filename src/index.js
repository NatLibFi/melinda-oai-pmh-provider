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

import startApp from './app';
import {bibOpendata, bibPrivileged} from './providers/bib';
import {PROVIDER_RESOURCE, PROVIDER_OPEN_DATA} from './config';

const [opendata, privileged] = getProviders();

if (PROVIDER_OPEN_DATA) {
	startApp(opendata);
} else {
	startApp(privileged);
}

function getProviders() {
	switch (PROVIDER_RESOURCE) {
		case 'bib':
			return [bibOpendata, bibPrivileged];
		/*	Case 'aut_names':
		start(autNamesOpendata, autNamesPrivileged);
		break;
		case 'aut_subjects':
		start(autSubjectsOpendata, autSubjectsPrivileged);
		break; */
		default:
			break;
	}
}
