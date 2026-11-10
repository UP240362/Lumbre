// Lo que una acción del servidor le contesta al formulario.
export type EstadoFormulario = {
  error?: string; // mensaje en rojo
  mensaje?: string; // mensaje de éxito
  // Se devuelven para no borrar lo que la persona ya había escrito.
  correo?: string;
  nombre?: string;
};
