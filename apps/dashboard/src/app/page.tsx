export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">clenjex</h1>
            <p className="text-gray-400 text-sm mt-1">
              Autonomous AI Trading Agent — Kraken CLI + ERC-8004 on Base Sepolia
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-sm font-medium">PAPER TRADING</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total PnL", value: "$0.00", sub: "+0.00%", color: "text-gray-300" },
            { label: "Total Trades", value: "0", sub: "0 open positions", color: "text-gray-300" },
            { label: "Reputation Score", value: "—", sub: "ERC-8004 on-chain", color: "text-blue-400" },
            { label: "Max Drawdown", value: "0%", sub: "Risk engine active", color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wide">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              <p className="text-gray-500 text-xs mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Two lane status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Kraken Lane */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <h2 className="text-lg font-semibold text-blue-400">Kraken Lane</h2>
              <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">MCP</span>
            </div>
            <p className="text-gray-400 text-sm">Kraken CLI MCP server → autonomous order execution</p>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <div>🔌 MCP connection: <span className="text-yellow-400">pending</span></div>
              <div>📊 Pairs: BTC/USD, ETH/USD, SOL/USD</div>
              <div>🤖 Signal: EMA + RSI + Volume (Gemini 2.5 Flash)</div>
            </div>
          </div>

          {/* DeFi Lane */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔗</span>
              <h2 className="text-lg font-semibold text-purple-400">DeFi Lane (ERC-8004)</h2>
              <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">Base Sepolia</span>
            </div>
            <p className="text-gray-400 text-sm">EIP-712 TradeIntents → Safe (EIP-1271) → Risk Router</p>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <div>🪪 Agent NFT: <span className="text-yellow-400">not registered yet</span></div>
              <div>🔐 Safe wallet: <span className="text-yellow-400">deploying...</span></div>
              <div>📡 Risk Router: <span className="text-yellow-400">awaiting deployment</span></div>
            </div>
          </div>
        </div>

        {/* ERC-8004 identity card */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-purple-400">🪪 Agent Identity (ERC-8004)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Agent Name", value: "clenjex" },
              { label: "NFT ID", value: "—" },
              { label: "Chain", value: "Base Sepolia" },
              { label: "Validation Status", value: "Pending" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-gray-500 text-xs">{item.label}</p>
                <p className="text-gray-200 font-medium mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trade log */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Trade Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <tr>
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Pair</th>
                  <th className="pb-3 pr-4">Side</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Price</th>
                  <th className="pb-3 pr-4">Lane</th>
                  <th className="pb-3 pr-4">PnL</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8} className="text-gray-500 text-center py-8">
                    No trades yet — agent is starting up...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
