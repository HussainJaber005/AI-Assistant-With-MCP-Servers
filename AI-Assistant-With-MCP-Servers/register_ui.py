REGISTER_HTML = r"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Register</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #09090b;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    h1 {
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 28px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      color: #d4d4d8;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 12px;
      margin-bottom: 16px;
      border-radius: 10px;
      border: 1px solid #3f3f46;
      background: #09090b;
      color: white;
      outline: none;
    }
    button {
      width: 100%;
      background: #6d28d9;
      color: white;
      border: none;
      padding: 12px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 15px;
    }
    button:hover {
      background: #7c3aed;
    }
    .msg {
      margin-top: 14px;
      color: #fca5a5;
      font-size: 14px;
      text-align: center;
    }
    .link {
      margin-top: 18px;
      text-align: center;
      font-size: 14px;
      color: #a1a1aa;
    }
    a {
      color: #c4b5fd;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Register</h1>
    <form method="post" action="/register">
      <label>Username</label>
      <input type="text" name="username" required />

      <label>Email</label>
      <input type="email" name="email" required />

      <label>Password</label>
      <input type="password" name="password" required />

      <button type="submit">Register</button>
    </form>

    <div class="link">
      Already have an account? <a href="/login">Login</a>
    </div>

    {{error_block}}
  </div>
</body>
</html>
"""