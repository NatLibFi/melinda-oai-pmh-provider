

import Langs from 'langs';
import moment from 'moment';
import {Builder} from 'xml2js';
import createDebugLogger from 'debug';

// Note: this marc-to-dc conversion is really-really-simple not actually usable placeholder
// If we want to actually supply dc from OAI-PMH this should be replaced by something more comprehensive

export default record => {
  const debug = createDebugLogger(`@natlibfi/melinda-oai-pmh-provider/marc-to-dc`);

  const elements = getElements();
  const obj = {
    'oai_dc:dc': {
      $: {
        'xmlns:oai_dc': 'http://www.openarchives.org/OAI/2.0/oai_dc/',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd'
      },
      ...elements
    }
  };

  return build(obj);

  function getElements() {
    const title = {'dc:title': getTitle()};
    const language = {'dc:language': getLanguage()};
    const date = {'dc:date': getDate()};
    debug(`We have date element ${JSON.stringify(date)}`);

    return [title, language, date].filter(identity).reduce((acc, obj) => ({...acc, ...obj}), {});

    function getTitle() {
      const subfields = record.get(/^245$/u)?.[0]?.subfields || [];
      return subfields.reduce(toStr, '');

      function toStr(acc, {value}) {
        return `${acc}${value}`;
      }
    }

    function getLanguage() {
      const value = record.get(/^008$/u)?.[0]?.value || '';
      const code = value.slice(35, 38);
      const result = Langs.where('2', code) || [];
      return result['1'] || '';
    }

    // dc.date should propably not be creation date of the record
    function getDate() {
      const value = record.get(/^008$/u)?.[0]?.value || '';
      const timeStr = value.slice(0, 6);
      debug(`We have value from 008: ${value}`);
      debug(`We have timeStr from value: ${timeStr}`);
//      const result = timeStr ? moment(timeStr, 'YYMMDD').toISOString(true) : '';
      const result = timeStr ? moment.utc(timeStr, 'YYMMDD').toISOString(true) : '';
      debug(`We have result ${result}`);
      return result;
    }

    function identity(obj) {
      // Remove entries with undefined values
      return Object.values(obj)[0];
    }
  }

  function build(obj) {
    try {
      const builder = new Builder({
        xmldec: {
          version: '1.0',
          encoding: 'UTF-8',
          standalone: false
        }
      });

      return builder.buildObject(obj);
    } catch (err) {
      /* istanbul ignore next: Too generic to test */
      throw new Error(`XML conversion failed ${err.message} for data: ${JSON.stringify(obj)}`);
    }
  }
};
