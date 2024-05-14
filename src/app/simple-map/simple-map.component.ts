import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-simple-map',
  templateUrl: './simple-map.component.html',
  styleUrls: ['./simple-map.component.css']
})
export class SimpleMapComponent implements OnChanges {

  @Input() mapDefinition: any;
  @Input() concept: any;

  mapResults: any[] = [];
  notFound = false;
  loading = false;

  constructor(private terminologyService: TerminologyService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['concept'] && changes['concept'].currentValue) {
      console.log('Concept changed:', changes['concept'].currentValue);
      // You can add more logic here to react to the changes
      this.notFound = false;
      this.loading = true;
      this.terminologyService.getSimpleMapTargets(this.concept?.code, this.mapDefinition.codeSystem).subscribe(
        (data) => {
          this.mapResults = [];
          if (data.parameter) {
            data.parameter.forEach((element: any) => {
              if (element.name == 'match') {
                element.part.forEach((part: any) => {
                  if (part.name == 'concept') this.mapResults.push(part.valueCoding);
                });
              }
            });
          }
          console.log('Data:', data)
          console.log('Map results:', this.mapResults); 
          this.loading = false;
        },
        (error) => {
          console.log('Not found');
          // No map
          this.loading = false;
          this.notFound = true;
        }
      );
    }
  }



}
