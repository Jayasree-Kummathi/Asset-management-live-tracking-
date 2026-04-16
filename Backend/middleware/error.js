const errorHandler = (err, req, res, next) => {
  console.error(err);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    const detail = err.detail || '';
    const field  = detail.match(/Key \((.+)\)=/)?.[1] || 'field';
    return res.status(400).json({ success: false, message: `Duplicate value: ${field} already exists` });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
  }

  // PostgreSQL check constraint violation
  if (err.code === '23514') {
    return res.status(400).json({ success: false, message: 'Invalid value for constrained field' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
