/**
* Copyright 2019-2020, 2023 University Of Helsinki (The National Library Of Finland)
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

import bib from './bib';
import autNames from './aut-names';
import autSubjects from './aut-subjects';
import autWorks from './aut-works';
import autAux from './aut-auxiliary';

export default ({contextName, ...params}) => {
  const map = {bib, autNames, autSubjects, autWorks, autAux};
  return map[contextName](params);
};
