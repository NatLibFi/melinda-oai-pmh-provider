
/**
* Copyright 2019-2020 University Of Helsinki (The National Library Of Finland)
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

export const requestDateStampFormats = [
  'YYYY-MM-DD',
  'YYYY-MM-DD[T]hh:mm:ss'
];

export const metadataFormats = [
  {
    prefix: 'oai_dc',
    schema: 'http://www.openarchives.org/OAI/2.0/oai_dc.xsd',
    namespace: 'http://www.openarchives.org/OAI/2.0/oai_dc/'
  },
  {
    prefix: 'marc21',
    schema: 'https://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd',
    namespace: 'http://www.loc.gov/MARC21/slim'
  },
  {
    prefix: 'melinda_marc',
    schema: 'https://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd',
    namespace: 'https://melinda.kansalliskirjasto.fi/melinda-marc'
  }
];
