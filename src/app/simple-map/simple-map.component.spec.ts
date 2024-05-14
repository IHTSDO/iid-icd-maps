import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleMapComponent } from './simple-map.component';

describe('SimpleMapComponent', () => {
  let component: SimpleMapComponent;
  let fixture: ComponentFixture<SimpleMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SimpleMapComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimpleMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
