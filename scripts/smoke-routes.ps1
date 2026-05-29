$routes = @("/", "/pricing", "/industries", "/about", "/grade", "/help", "/community", "/academy", "/awards", "/wins", "/marketplace", "/affiliate", "/contact", "/blog", "/legal/terms", "/legal/privacy", "/legal/aup", "/legal/refund", "/login", "/signup")
$pass = 0; $fail = 0
foreach ($route in $routes) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000$route" -Method GET -UseBasicParsing -ErrorAction Stop -TimeoutSec 30
        Write-Host "[OK] $route -> $($resp.StatusCode)" -ForegroundColor Green
        $pass++
    } catch {
        $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "ERR" }
        Write-Host "[FAIL] $route -> $code" -ForegroundColor Red
        $fail++
    }
}
Write-Host "Pass: $pass / Fail: $fail"
