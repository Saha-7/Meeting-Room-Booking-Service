function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NotFound',
    message: `No route matches ${req.method} ${req.path}`
  });
}

export { notFoundHandler };
