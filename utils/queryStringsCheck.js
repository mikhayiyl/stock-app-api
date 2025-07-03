module.exports = function (query) {
  const filter = {};
  if (query.itemCode) {
    filter.itemCode = query.itemCode;

    // If partial match is acceptable, switch to RegExp
    // filter.itemCode = new RegExp(query.itemCode, 'i');
  }
  return filter;
};
