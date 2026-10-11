const ProviderBalanceSnapshot = require('../models/ProviderBalanceSnapshot');
const ALLOWED = new Set(['smsbower','benotp','loggsplug','samehasocialhub']);
const dateKey = (d) => new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
exports.saveProviderSnapshots = async (req, res) => {
  try {
    const balances = req.body?.balances;
    if (!Array.isArray(balances) || balances.length === 0 || balances.length > 4) return res.status(400).json({success:false,message:'Expected 1 to 4 provider balances'});
    const seen = new Set();
    const clean = balances.map(item => {
      const provider = String(item.provider || '').toLowerCase();
      const balance = Number(item.balance);
      const currency = String(item.currency || '').toUpperCase();
      if (!ALLOWED.has(provider) || seen.has(provider) || item.balance == null || !Number.isFinite(balance) || !['NGN','USD'].includes(currency)) throw new Error('Invalid or duplicate provider balance');
      seen.add(provider);
      return {provider,balance,currency};
    });
    const date = dateKey(new Date());
    const recordedAt = new Date();
    await Promise.all(clean.map(item => ProviderBalanceSnapshot.updateOne({provider:item.provider,date}, {$set:{balance:item.balance,currency:item.currency,recordedAt}}, {upsert:true})));
    return res.json({success:true,saved:clean.length,date});
  } catch (error) {
    if (error.message === 'Invalid or duplicate provider balance') return res.status(400).json({success:false,message:error.message});
    console.error('Provider snapshot save error:', error);
    return res.status(500).json({success:false,message:'Unable to save provider snapshots'});
  }
};