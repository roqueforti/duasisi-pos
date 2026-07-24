import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Your Deployed Google Apps Script Web App URL
  static String gasWebAppUrl =
      'https://script.google.com/macros/s/AKfycbxVfZcTiFhZqQIVjvxoIAtIJbpVJbVz8MWloZztbk3GIV50hNa2Fr0Lu50MHWoaSGM1Mw/exec';

  /// Universal REST API invoker
  static Future<dynamic> callBackend(String action, [List<dynamic>? args]) async {
    try {
      final response = await http.post(
        Uri.parse(gasWebAppUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'action': action,
          'args': args ?? [],
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 302) {
        final data = jsonDecode(response.body);
        if (data is Map && data.containsKey('error') && data['error'] == true) {
          throw Exception(data['message'] ?? 'API Error');
        }
        return data;
      } else {
        throw Exception('Server Error: ${response.statusCode}');
      }
    } catch (e) {
      print('API Error [$action]: $e');
      rethrow;
    }
  }
}
