module.exports = () => {
  return async function(ctx, next) {
    const result = await ctx.service.weapp.validate();
    ctx.state.$wxInfo = result;

    await next();
  };
};
