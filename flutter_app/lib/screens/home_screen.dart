import 'package:flutter/material.dart';
import 'transaksi_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  final String role;
  final String userLabel;

  const HomeScreen({
    super.key,
    required this.role,
    required this.userLabel,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isManager = widget.role == 'MANAGER';

    final List<Widget> pages = [
      const TransaksiScreen(),
      const Center(child: Text('📋 Pipeline Tracking Kanban')),
      const Center(child: Text('⏰ Absensi Shift')),
      const Center(child: Text('📦 Inventory Stok')),
      const Center(child: Text('🌀 Status Mesin')),
      if (isManager) ...[
        const Center(child: Text('👥 Pegawai & Kinerja')),
        const Center(child: Text('🏷️ Produk & Layanan')),
        const Center(child: Text('📈 Laporan Omzet')),
      ]
    ];

    final titles = [
      'Transaksi Baru',
      'Pipeline Tracking',
      'Absensi Shift',
      'Inventory Stok',
      'Status Mesin',
      if (isManager) ...['Pegawai & Kinerja', 'Produk & Layanan', 'Laporan Omzet']
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          titles[_selectedTabIndex],
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
        ),
        actions: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFE9F1F2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: const Color(0xFF1E4648),
                  child: Text(
                    widget.role == 'MANAGER' ? 'M' : 'S',
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  widget.userLabel,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E4648)),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.lock_outline, size: 20),
            onPressed: () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => const LoginScreen()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF11292B),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF11292B)),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E4648),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(child: Text('✨', style: TextStyle(fontSize: 22))),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DUA SISI POS',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.black, fontSize: 16),
                      ),
                      Text(
                        'Smart Management',
                        style: TextStyle(color: Colors.grey, fontSize: 10),
                      ),
                    ],
                  )
                ],
              ),
            ),
            _buildNavItem(0, '🛒 Transaksi Baru'),
            _buildNavItem(1, '📋 Pipeline Tracking'),
            _buildNavItem(2, '⏰ Absensi Shift'),
            _buildNavItem(3, '📦 Inventory Stok'),
            _buildNavItem(4, '🌀 Status Mesin'),
            if (isManager) ...[
              const Divider(color: Colors.white24),
              const Padding(
                padding: EdgeInsets.only(left: 16, top: 8, bottom: 4),
                child: Text('Manajemen', style: TextStyle(color: Colors.tealAccent, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
              _buildNavItem(5, '👥 Pegawai & Kinerja'),
              _buildNavItem(6, '🏷️ Produk & Layanan'),
              _buildNavItem(7, '📈 Laporan Omzet'),
            ]
          ],
        ),
      ),
      body: pages[_selectedTabIndex],
    );
  }

  Widget _buildNavItem(int index, String label) {
    final isSelected = _selectedTabIndex == index;
    return ListTile(
      selected: isSelected,
      selectedTileColor: const Color(0xFF1E4648),
      title: Text(
        label,
        style: TextStyle(
          color: isSelected ? Colors.white : Colors.white70,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          fontSize: 13,
        ),
      ),
      onTap: () {
        setState(() => _selectedTabIndex = index);
        Navigator.pop(context);
      },
    );
  }
}
