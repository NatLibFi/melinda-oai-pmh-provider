


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
