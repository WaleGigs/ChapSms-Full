class ProviderService {
  constructor() {
    this.provider = "5sim";
  }

  async buyNumber(country, service) {
    throw new Error("Provider integration not implemented");
  }

  async getSms(orderId) {
    throw new Error("Provider integration not implemented");
  }

  async cancel(orderId) {
    throw new Error("Provider integration not implemented");
  }
}

module.exports = new ProviderService();