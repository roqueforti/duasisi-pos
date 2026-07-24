import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class TransaksiScreen extends StatefulWidget {
  const TransaksiScreen({super.key});

  @override
  State<TransaksiScreen> createState() => _TransaksiScreenState();
}

class _TransaksiScreenState extends State<TransaksiScreen> {
  String _serviceMode = 'SelfService';
  List<dynamic> _layananList = [];
  Map<String, Map<String, dynamic>> _keranjang = {};
  String _customerName = '';
  String _customerPhone = '';
  bool _isLoading = false;

  final currencyFmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _loadLayanan();
  }

  void _loadLayanan() async {
    setState(() => _isLoading = true);
    try {
      final list = await ApiService.callBackend('getLayananList', [_serviceMode]);
      setState(() {
        _layananList = list ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _setServiceMode(String mode) {
    setState(() {
      _serviceMode = mode;
      _keranjang.clear();
    });
    _loadLayanan();
  }

  void _ubahQty(String nama, double harga, int delta) {
    setState(() {
      if (!_keranjang.containsKey(nama)) {
        _keranjang[nama] = {
          'layanan': nama,
          'hargaSatuan': harga,
          'qty': 0,
        };
      }

      int newQty = (_keranjang[nama]!['qty'] as int) + delta;
      if (newQty <= 0) {
        _keranjang.remove(nama);
      } else {
        _keranjang[nama]!['qty'] = newQty;
      }
    });
  }

  int get _totalBayar {
    int total = 0;
    _keranjang.forEach((key, item) {
      total += ((item['qty'] as int) * (item['hargaSatuan'] as double)).toInt();
    });
    return total;
  }

  void _prosesCheckoutModal() {
    if (_keranjang.isEmpty) return;

    final namaCtrl = TextEditingController(text: _customerName);
    final phoneCtrl = TextEditingController(text: _customerPhone);
    final petugasCtrl = TextEditingController(text: 'Kasir 1');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '💳 Proses Transaksi ($_serviceMode)',
                    style: const TextStyle(fontWeight: FontWeight.black, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(),
              const SizedBox(height: 8),
              const Text('📝 Data Pelanggan & Petugas', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 12),
              TextField(
                controller: namaCtrl,
                decoration: const InputDecoration(
                  labelText: 'Nama Pelanggan *',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'No HP / WhatsApp',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: petugasCtrl,
                decoration: const InputDecoration(
                  labelText: 'Nama Petugas *',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E4648),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    if (namaCtrl.text.trim().isEmpty) return;
                    Navigator.pop(context);

                    final data = {
                      'namaPelanggan': namaCtrl.text.trim(),
                      'noHp': phoneCtrl.text.trim(),
                      'estimasiSelesai': '',
                      'namaPetugas': petugasCtrl.text.trim(),
                      'tipeLayanan': _serviceMode,
                      'items': _keranjang.values.toList(),
                    };

                    try {
                      final res = await ApiService.callBackend('simpanTransaksi', [data]);
                      if (!mounted) return;
                      setState(() {
                        _keranjang.clear();
                        _customerName = '';
                        _customerPhone = '';
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('✅ ${res['noNota']} — ${currencyFmt.format(res['total'])}'),
                          backgroundColor: const Color(0xFF10B981),
                        ),
                      );
                    } catch (e) {
                      // Handle error
                    }
                  },
                  child: const Text('✅ Konfirmasi & Simpan', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktopOrTablet = constraints.maxWidth > 700;

        Widget leftProductCatalog = Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('🫧 Self Service'),
                    selected: _serviceMode == 'SelfService',
                    onSelected: (_) => _setServiceMode('SelfService'),
                    selectedColor: const Color(0xFF1E4648),
                    labelStyle: TextStyle(
                      color: _serviceMode == 'SelfService' ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('👔 Full Service'),
                    selected: _serviceMode == 'FullService',
                    onSelected: (_) => _setServiceMode('FullService'),
                    selectedColor: const Color(0xFF1E4648),
                    labelStyle: TextStyle(
                      color: _serviceMode == 'FullService' ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : GridView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: isDesktopOrTablet ? 4 : 2,
                        childAspectRatio: 0.9,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                      ),
                      itemCount: _layananList.length,
                      itemBuilder: (context, index) {
                        final item = _layananList[index];
                        final nama = item['nama'];
                        final harga = (item['harga'] as num).toDouble();
                        final qty = _keranjang.containsKey(nama) ? _keranjang[nama]!['qty'] as int : 0;

                        return Card(
                          elevation: 1,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          child: InkWell(
                            onTap: () => _ubahQty(nama, harga, 1),
                            borderRadius: BorderRadius.circular(16),
                            child: Column(
                              children: [
                                Expanded(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE9F1F2),
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                    ),
                                    child: Center(
                                      child: Text(item['icon'] ?? '🧺', style: const TextStyle(fontSize: 32)),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(8.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        nama,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        currencyFmt.format(harga),
                                        style: const TextStyle(
                                          color: Color(0xFF1E4648),
                                          fontWeight: FontWeight.w900,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );

        Widget rightCartPanel = Container(
          width: isDesktopOrTablet ? 320 : double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            border: isDesktopOrTablet
                ? const Border(left: BorderSide(color: Color(0xFFE2E8F0)))
                : null,
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                color: const Color(0xFFF8FAFC),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _customerName.isEmpty ? '+ Add Customer' : '👤 $_customerName',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E4648)),
                    ),
                    Text(_serviceMode, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: _keranjang.entries.map((e) {
                    final sub = (e.value['qty'] as int) * (e.value['hargaSatuan'] as double);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                              Text('x${e.value['qty']}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                            ],
                          ),
                          Text(currencyFmt.format(sub), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text(
                          currencyFmt.format(_totalBayar),
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF1E4648)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E4648),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _prosesCheckoutModal,
                        child: Text('💳 Charge ${currencyFmt.format(_totalBayar)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );

        if (isDesktopOrTablet) {
          return Row(
            children: [
              Expanded(child: leftProductCatalog),
              rightCartPanel,
            ],
          );
        } else {
          return Column(
            children: [
              Expanded(child: leftProductCatalog),
              SizedBox(height: 220, child: rightCartPanel),
            ],
          );
        }
      },
    );
  }
}
