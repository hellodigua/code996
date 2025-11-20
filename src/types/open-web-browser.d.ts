declare module 'open-web-browser' {
  function openBrowser(url: string): Promise<void>
  export = openBrowser
}
