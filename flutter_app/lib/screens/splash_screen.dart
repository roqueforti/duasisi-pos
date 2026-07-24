import 'dart:async';
import 'package:flutter/material.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  int _taglineIndex = 0;

  final List<String> _taglines = [
    'Sedang membilas data... 🫧',
    'Memutar drum mesin... 🌀',
    'Menyiapkan wangi parfum... 🧺',
    'Hampir bersih! ✨'
  ];

  late Timer _timer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();

    _timer = Timer.periodic(const Duration(milliseconds: 450), (timer) {
      if (_taglineIndex < _taglines.length - 1) {
        setState(() => _taglineIndex++);
      }
    });

    Timer(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        PageRouteBuilder(
          pageBuilder: (context, anim, secAnim) => const LoginScreen(),
          transitionsBuilder: (context, anim, secAnim, child) {
            return FadeTransition(opacity: anim, child: child);
          },
          transitionDuration: const Duration(milliseconds: 600),
        ),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF11292B),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                RotationTransition(
                  turns: _controller,
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E4648),
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withOpacity(0.3),
                          blurRadius: 24,
                          spreadRadius: 4,
                        )
                      ],
                    ),
                    child: const Center(
                      child: Text('🌀', style: TextStyle(fontSize: 44)),
                    ),
                  ),
                ),
                const Positioned(
                  top: -6,
                  right: -6,
                  child: Text('🫧', style: TextStyle(fontSize: 24)),
                ),
                const Positioned(
                  bottom: -6,
                  left: -6,
                  child: Text('✨', style: TextStyle(fontSize: 22)),
                ),
              ],
            ),
            const SizedBox(height: 28),
            const Text(
              'Dua SiSi POS',
              style: TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _taglines[_taglineIndex],
              style: const TextStyle(
                color: Color(0xFF99F6E4),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: 160,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: const LinearProgressIndicator(
                  backgroundColor: Colors.white10,
                  color: Color(0xFF10B981),
                  minHeight: 5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
