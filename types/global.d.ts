// Allow CSS files to be imported as side effects
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
