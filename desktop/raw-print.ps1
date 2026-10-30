# Manda un archivo de bytes (comandos ESC/POS) directo a una impresora de Windows, en modo RAW:
# la cola de impresión no lo convierte en página, así la térmica corta el papel y usa letra grande.
param([Parameter(Mandatory = $true)][string]$Printer, [Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class OrdenSimpleRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string name, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("No se encontro la impresora " + printer);
    try {
      var di = new DOCINFO { pDocName = "OrdenSimple", pDataType = "RAW" };
      if (StartDocPrinter(h, 1, di) == 0) throw new Exception("La impresora no acepto el trabajo");
      StartPagePrinter(h);
      int written;
      bool ok = WritePrinter(h, bytes, bytes.Length, out written);
      EndPagePrinter(h);
      EndDocPrinter(h);
      if (!ok || written != bytes.Length) throw new Exception("No se pudo enviar todo a la impresora");
    } finally { ClosePrinter(h); }
  }
}
"@

[OrdenSimpleRaw]::Send($Printer, [System.IO.File]::ReadAllBytes($File))
