import {clone} from '@natlibfi/melinda-commons';

export function sanitizeQueryParams(queryParams) {
  const query = clone(queryParams);

  Object.keys(query).forEach(key => {
    if (key === 'resumptionToken') {
      return;
    }

    validateValue(query[key]);
    // eslint-disable-next-line
    query[key] = query[key].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\'', '&apos;').replace('"', '&quot;');
  });

  return query;

  function validateValue(value) {
    if (value.replace(/(?:\w|\d|-|:|\.|\/\w|\/\d|)/ug, '').length > 0) {
      throw new Error(`Invalid query param: ${value}, contains invalid charracters`);
    }

    return;
  }
}
