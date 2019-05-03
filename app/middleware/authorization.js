module.exports = () => {
  return async function(ctx, next) {
    const result = await ctx.service.weapp.authorize();
    ctx.state.$wxInfo = result;

    await next();
  };
};
