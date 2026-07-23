const crudMutation = async (engine, payload, type, resource) => {
  await engine.mutate({
    resource,
    type,
    data: payload,
  });
};

export default crudMutation;